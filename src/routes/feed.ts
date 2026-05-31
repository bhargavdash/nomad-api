import { Router } from 'express';
import { prisma } from '../db/client.js';
import { env } from '../env.js';
import { currentSeason, currentSeasonKey } from '../services/season.service.js';

const router = Router();

// SA-8: shape of one trending destination. `imageUrl` is resolved + self-hosted
// by the agent at trending-refresh time and stored in the cache row, so this
// API serves it verbatim — no image resolution on the read path.
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

// Agent-refresh burst-debounce: at most one LLM refresh trigger per 60s.
let refreshLastAt = 0;
const REFRESH_LOCKOUT_MS = 60_000;

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

// GET /api/v1/trending — public, no auth needed.
// Reads the cached row for the current season. If absent, serves whatever is
// in the cache (bootstrap or last-season) and kicks off an async refresh
// against the agent so the next caller sees up-to-date data. Destination
// images are resolved + self-hosted by the agent at refresh time and served
// verbatim from the cached row — this endpoint never resolves images.
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

  res.json({
    season: row?.season ?? currentSeason(),
    seasonKey: row?.seasonKey ?? null,
    refreshedAt: row?.refreshedAt ?? null,
    india: payload.india,
    international: payload.international,
  });
});

export default router;
