-- =============================================================================
-- Backfill product_slug for any SKU that doesn't have one.
-- Root cause: admin product creation never set product_slug, so those SKUs'
-- storefront "View details" links couldn't resolve and fell back to a filter
-- link. The app code now always sets product_slug on create; this one-off
-- backfill fixes any rows created before that fix.
-- =============================================================================

BEGIN;

UPDATE skus
SET product_slug = lower(regexp_replace(sku || '-' || tyre_size_display, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE product_slug IS NULL;

-- Guard against duplicate slugs from the backfill above (append a short id suffix)
UPDATE skus s
SET product_slug = s.product_slug || '-' || substr(s.product_id::text, 1, 8)
WHERE s.product_slug IN (
  SELECT product_slug FROM skus GROUP BY product_slug HAVING COUNT(*) > 1
);

COMMIT;
