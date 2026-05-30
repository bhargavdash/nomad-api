import { Router } from 'express';
import { prisma } from '../db/client.js';
import { env } from '../env.js';
import { resolvePlaceImage } from '../services/placeImage.service.js';
import { currentSeason, currentSeasonKey } from '../services/season.service.js';

const router = Router();

// SA-8: shape of one trending destination as the agent writes it + as the
// Node API hydrates it. `imageUrl` is null at agent-write time and gets
// populated lazily by `hydrateImagesIfNeeded()` after the first cache read.
type TrendingDest = {
  name: string;
  country: string;
  duration: string;
  blurb: string;
  vibe_tags: string[];
  imageUrl?: string | null;
};

type TrendingPayload = {
  india: TrendingDest[];
  international: TrendingDest[];
};

// Refresh lockouts — separate concerns:
//   refreshLastAt  — agent refresh (LLM call). 60s. Burst-debounce.
//   hydrateLastAt  — Wikipedia hydration. 20s is plenty for the ~1s burst
//                    of parallel Wikipedia fetches to land + write back.
let refreshLastAt = 0;
let hydrateLastAt = 0;
const REFRESH_LOCKOUT_MS = 60_000;
const HYDRATE_LOCKOUT_MS = 20_000;

async function triggerAgentRefresh(seasonKey: string): Promise<void> {
  const now = Date.now();
  if (now - refreshLastAt < REFRESH_LOCKOUT_MS) return;
  refreshLastAt = now;

  try {
    const res = await fetch(`${env.AGENT_SERVICE_URL}/agent/trending-refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.INTERNAL_AGENT_SECRET}`,
      },
      body: JSON.stringify({ season_key: seasonKey }),
    });
    if (!res.ok) {
      console.error(`[trending] agent refresh returned ${res.status} for ${seasonKey}`);
    }
  } catch (err) {
    console.error('[trending] agent refresh failed:', err);
  }
}

function isPayload(value: unknown): value is TrendingPayload {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<TrendingPayload>;
  return Array.isArray(p.india) && Array.isArray(p.international);
}

function needsHydration(payload: TrendingPayload): boolean {
  return [...payload.india, ...payload.international].some((d) => d && !d.imageUrl);
}

async function hydrateOne(dest: TrendingDest): Promise<TrendingDest> {
  if (dest.imageUrl) return dest;
  // Resolver memoizes in-process, so repeats are free across destinations
  // and across requests within the same process lifetime.
  const url = await resolvePlaceImage(dest.name, dest.country);
  return { ...dest, imageUrl: url ?? null };
}

async function hydrateImagesIfNeeded(rowId: string, payload: TrendingPayload): Promise<void> {
  const now = Date.now();
  if (now - hydrateLastAt < HYDRATE_LOCKOUT_MS) return;
  hydrateLastAt = now;

  try {
    const [india, international] = await Promise.all([
      Promise.all(payload.india.map(hydrateOne)),
      Promise.all(payload.international.map(hydrateOne)),
    ]);
    const enriched: TrendingPayload = { india, international };

    await prisma.trendingCache.update({
      where: { id: rowId },
      data: { payload: enriched as unknown as object },
    });
  } catch (err) {
    console.error('[trending] image hydration failed:', err);
  }
}

// GET /api/v1/trending — public, no auth needed.
// Reads the cached row for the current season. If absent, serves whatever
// is in the cache (bootstrap or last-season) and kicks off an async refresh
// against the agent so the next caller sees up-to-date data. If any
// destination in the served row is missing a Wikipedia-resolved image, fires
// off a background hydration write so the *next* read includes real photos.
router.get('/trending', async (_req, res) => {
  const key = currentSeasonKey();

  let row = await prisma.trendingCache.findUnique({ where: { seasonKey: key } });
  if (!row) {
    row = await prisma.trendingCache.findFirst({
      orderBy: { refreshedAt: 'desc' },
    });
    triggerAgentRefresh(key).catch((err) => console.error('[trending] refresh task threw:', err));
  }

  const payload: TrendingPayload = isPayload(row?.payload)
    ? (row.payload as unknown as TrendingPayload)
    : { india: [], international: [] };

  if (row && needsHydration(payload)) {
    hydrateImagesIfNeeded(row.id, payload).catch((err) =>
      console.error('[trending] hydration task threw:', err),
    );
  }

  res.json({
    season: row?.season ?? currentSeason(),
    seasonKey: row?.seasonKey ?? null,
    refreshedAt: row?.refreshedAt ?? null,
    india: payload.india,
    international: payload.international,
  });
});

export default router;
