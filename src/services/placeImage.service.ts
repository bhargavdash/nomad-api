// ---------------------------------------------------------------------------
// Place-image resolver
//
// Resolves a real photo of a named place (destination / city / landmark) via
// Wikipedia. Returns a SCALED thumbnail URL, or null when there's no usable
// photo (the caller / frontend then uses its own deterministic fallback).
//
// Hard-won rules:
//   - Request `pithumbsize=1280` and use `thumbnail.source`. NEVER use the
//     `original` — originals are routinely 10-20 MB (a 3744x5616 / 20 MB image
//     was what made the frontend image optimizer time out with a 500). 1280px
//     forces Wikimedia to return a scaled `/thumb/` URL (~100-450 KB).
//   - Exact page title first (follows redirects), then fuzzy search — fuzzy
//     alone grabs the wrong page (e.g. "Munnar" -> its parent "Idukki district").
//   - Reject non-photo page-images: locator maps, flags, coats of arms, logos,
//     icons, SVGs (e.g. "Bali" exact-title returns an SVG locator map).
//   - Memoised in-process (long-lived Express server) so repeat lookups are free.
// ---------------------------------------------------------------------------

const WIKI_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'NomadAPI/1.0 (https://nomad.app; travel itinerary place images)';
const THUMB_SIZE = 1280;

const NON_PHOTO =
  /\.svg|flag|coat[_-]?of[_-]?arms|locator|location|emblem|\bseal\b|\blogo\b|\bicon\b|disambig/i;

const memo = new Map<string, string | null>();
const MEMO_MAX = 2000;

function remember(key: string, value: string | null): string | null {
  if (memo.size >= MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, value);
  return value;
}

function fileName(url: string): string {
  try {
    return decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');
  } catch {
    return url;
  }
}

function isPhoto(url: string | undefined): url is string {
  if (!url) return false;
  const name = fileName(url);
  if (/^map[-_]/i.test(name) || /[-_]map[-_.]/i.test(name)) return false;
  return !NON_PHOTO.test(name);
}

function cleanUrl(url: string): string {
  return url.split('?')[0];
}

interface WikiPage {
  index?: number;
  thumbnail?: { source?: string };
}

async function wikiPages(params: Record<string, string>): Promise<WikiPage[] | null> {
  const sp = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB_SIZE),
    origin: '*',
    ...params,
  });

  const res = await fetch(`${WIKI_ENDPOINT}?${sp.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
  const pages = data.query?.pages;
  return pages ? Object.values(pages) : null;
}

function pickPhoto(pages: WikiPage[]): string | null {
  const ordered = [...pages].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const page of ordered) {
    const candidate = page.thumbnail?.source;
    if (isPhoto(candidate)) return cleanUrl(candidate);
  }
  return null;
}

async function fromWikipedia(query: string, context: string): Promise<string | null> {
  // 1. Exact title (follows redirects, e.g. "Amber Fort" -> "Amer Fort").
  const exact = await wikiPages({ titles: query, redirects: '1' });
  if (exact) {
    const hit = pickPhoto(exact);
    if (hit) return hit;
  }
  // 2. Fuzzy search, biased with context (e.g. the trip destination / country).
  const search = context ? `${query} ${context}` : query;
  const fuzzy = await wikiPages({ generator: 'search', gsrsearch: search, gsrlimit: '3' });
  if (fuzzy) {
    const hit = pickPhoto(fuzzy);
    if (hit) return hit;
  }
  return null;
}

/**
 * Resolve the best real photo URL for a place, or null if none found.
 * `context` (e.g. the trip destination/country) disambiguates a city lookup.
 * Never throws — upstream failures resolve to null.
 */
export async function resolvePlaceImage(query: string, context = ''): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  const key = `${q.toLowerCase()}|${context.trim().toLowerCase()}`;
  if (memo.has(key)) return memo.get(key) ?? null;

  try {
    const url = await fromWikipedia(q, context.trim());
    return remember(key, url);
  } catch (err) {
    // Transient failure — don't memoise, so a later request can retry.
    console.error(
      '[placeImage] resolve failed:',
      err instanceof Error ? err.message : 'unknown error',
    );
    return null;
  }
}
