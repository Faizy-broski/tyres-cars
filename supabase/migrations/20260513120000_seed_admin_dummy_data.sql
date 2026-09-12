-- =============================================================================
-- Retired: this legacy dummy-data seed only ever targeted features that have
-- since been removed from the app (customer pricing groups, fitment-centre
-- jobs) alongside some product/catalogue rows. It also has several bugs that
-- surfaced on the first from-scratch replay (ambiguous column references,
-- unqualified uuid-ossp calls) and was clearly never fully exercised end to
-- end. superseded by 20260912010000_seed_core_dummy_data.sql, which seeds a
-- clean, verified tyre catalogue + customers + orders for the current
-- (simplified) schema. Left as a no-op rather than deleted so the applied
-- migration history stays intact.
-- =============================================================================

SELECT 1;
