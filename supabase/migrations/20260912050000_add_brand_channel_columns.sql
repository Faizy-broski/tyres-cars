-- =============================================================================
-- Fix: "column brands.channel_wholesale does not exist".
--
-- Root cause: backend/src/services/products.service.ts (createBrand,
-- updateBrand, listBrandsFull) and the admin brand form have always
-- read/written channel_wholesale / channel_retail / channel_marketplaces on
-- brands, but these columns were never actually part of the schema in
-- initial_schema.sql — a pre-existing gap between the app code and the DB,
-- unrelated to the recent simplification.
-- =============================================================================

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS channel_wholesale    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS channel_retail        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS channel_marketplaces  BOOLEAN NOT NULL DEFAULT FALSE;
