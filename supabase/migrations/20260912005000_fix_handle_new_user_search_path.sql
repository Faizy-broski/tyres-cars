-- =============================================================================
-- Fix: "Database error saving new user" on every signup.
--
-- Root cause: handle_new_user() is SECURITY DEFINER but has no search_path
-- pinned. The role that actually inserts into auth.users (supabase_auth_admin)
-- has its search_path locked to just `auth` (Supabase's default security
-- isolation for that role). Since the trigger function's body references
-- `profiles` unqualified, and SECURITY DEFINER does NOT change search_path
-- (only privileges), Postgres resolved it against `auth.profiles`, which
-- doesn't exist, failing the INSERT into auth.users entirely.
--
-- (Recovered from the live database's applied-migration history — this fix
-- was previously applied directly and never committed to this repo.)
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMIT;
