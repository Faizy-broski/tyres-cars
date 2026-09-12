-- =============================================================================
-- Fix: "permission denied for schema public" on every single query, even ones
-- using the service_role key.
--
-- Root cause: Supabase provisions `anon`, `authenticated`, and `service_role`
-- with baseline privileges (schema USAGE, table/sequence/function grants,
-- and matching default privileges for future objects) once, at project
-- creation time, entirely outside of migration history. The full-reset
-- (`supabase db reset --linked`) used to rebuild this schema from scratch did
-- `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`, which wiped that
-- platform-configured grant structure — nothing in the migration history
-- restores it, since it was never a migration to begin with.
--
-- This grants the same baseline Supabase itself sets up on a fresh project,
-- so future resets stay correct without needing this diagnosis again.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
