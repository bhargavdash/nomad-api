// India-aware seasonal key used by the trending cache.
//   Mar–May          → "summer"
//   Jun–Sep          → "monsoon"
//   Oct–Nov          → "post-monsoon"
//   Dec, Jan, Feb    → "winter"
//
// Cache rotation is keyed on `{season}-{year}` so the cache rolls over
// either when the season changes or when the calendar year ticks past
// during winter. The agent service uses the same logic when writing
// (see nomad-agent/app/agents/trending.py) — keep them in sync.

export type Season = 'summer' | 'monsoon' | 'post-monsoon' | 'winter';

export function currentSeason(now: Date = new Date()): Season {
  const month = now.getUTCMonth(); // 0 = Jan
  if (month >= 2 && month <= 4) return 'summer';
  if (month >= 5 && month <= 8) return 'monsoon';
  if (month >= 9 && month <= 10) return 'post-monsoon';
  return 'winter';
}

export function currentSeasonKey(now: Date = new Date()): string {
  return `${currentSeason(now)}-${now.getUTCFullYear()}`;
}
