-- =============================================================================
-- Migration: Row Level Security (RLS) for all tables
--
-- Why RLS?
--   Even though our Express backend enforces ownership checks, RLS is a
--   second layer of defence at the database level. If a bug bypasses the
--   backend, Postgres itself refuses the query.
--
--   We use the Supabase service-role key in the backend (bypasses RLS for
--   trusted server-side operations) and the anon key only for public reads.
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- (Run AFTER 20260501_01_profile_trigger.sql)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- The trigger function (SECURITY DEFINER) handles INSERT — no INSERT policy
-- needed from user sessions.

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips: select own"
  ON public.trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "trips: insert own"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trips: update own"
  ON public.trips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "trips: delete own"
  ON public.trips FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- itinerary_days
-- ---------------------------------------------------------------------------
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itinerary_days: select via trip"
  ON public.itinerary_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_days.trip_id
        AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "itinerary_days: insert via trip"
  ON public.itinerary_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_days.trip_id
        AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "itinerary_days: update via trip"
  ON public.itinerary_days FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_days.trip_id
        AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "itinerary_days: delete via trip"
  ON public.itinerary_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_days.trip_id
        AND trips.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- stops
-- ---------------------------------------------------------------------------
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stops: select via trip"
  ON public.stops FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = stops.trip_id
        AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "stops: insert via trip"
  ON public.stops FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = stops.trip_id
        AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "stops: update via trip"
  ON public.stops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = stops.trip_id
        AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "stops: delete via trip"
  ON public.stops FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = stops.trip_id
        AND trips.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- research_jobs
-- ---------------------------------------------------------------------------
ALTER TABLE public.research_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "research_jobs: select via trip"
  ON public.research_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = research_jobs.trip_id
        AND trips.user_id = auth.uid()
    )
  );

-- research_jobs are only written by the backend (service role) — no user
-- INSERT/UPDATE/DELETE policies needed.

-- ---------------------------------------------------------------------------
-- trending_destinations and insights — public read, no user writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.trending_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_destinations: public read"
  ON public.trending_destinations FOR SELECT
  USING (active = true);

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insights: public read"
  ON public.insights FOR SELECT
  USING (active = true);
