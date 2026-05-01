-- =============================================================================
-- Migration: Auto-create Profile row when a Supabase user signs up
--
-- How it works:
--   Supabase Auth manages users in the internal `auth.users` table.
--   Our app uses a `profiles` table in the public schema.
--   This trigger fires AFTER INSERT on auth.users and creates the matching
--   Profile row so the backend never hits a 404 on first login.
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop first so re-running this file is safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
