-- =============================================================================
-- Migration: SA-8 — replace hand-seeded trending + drop insights.
--
-- Old shape:
--   trending_destinations  hand-curated rows seeded from prisma/seed.ts
--   insights               hand-curated travel tips, fed nowhere on web,
--                          fed the (now-removed) home insights column on mobile.
--
-- New shape:
--   trending_cache         one row per (season, year). Payload is a JSON blob
--                          containing 10 Indian + 10 international destinations
--                          plus blurbs, written by nomad-agent on a seasonal
--                          cadence via a single Cerebras Qwen call. Read by
--                          GET /api/v1/trending; refresh fires off async to the
--                          agent when the cached season_key drifts from the
--                          current season key.
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- (Run AFTER 20260501_02_rls_policies.sql)
-- =============================================================================

DROP TABLE IF EXISTS public.insights;
DROP TABLE IF EXISTS public.trending_destinations;

CREATE TABLE public.trending_cache (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_key   text        NOT NULL UNIQUE,
  season       text        NOT NULL,
  year         integer     NOT NULL,
  payload      jsonb       NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trending_cache_refreshed_at_idx
  ON public.trending_cache (refreshed_at DESC);

-- Public read-only via RLS (matches the old trending_destinations posture).
ALTER TABLE public.trending_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_cache: public select"
  ON public.trending_cache FOR SELECT
  TO anon, authenticated
  USING (true);

-- Writes are only ever made by the agent using the Supabase service-role key,
-- which bypasses RLS — no policy required for INSERT/UPDATE/DELETE.
