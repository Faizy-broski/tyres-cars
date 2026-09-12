-- ============================================================
-- Migration: Strict spec compliance — rename fitment_centre_id → fitment_id
--            and centre_name → business_name; update payment_status enum
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- 1. Rename fitment_centres PK column and name column
-- -------------------------------------------------------
ALTER TABLE fitment_centres RENAME COLUMN fitment_centre_id TO fitment_id;

-- initial_schema.sql already defines both centre_name and business_name as
-- separate columns, so the straight rename below fails with "column
-- business_name already exists" on a from-scratch replay. Drop the redundant
-- legacy column instead — business_name is the one the app has always used.
ALTER TABLE fitment_centres DROP COLUMN IF EXISTS centre_name;

-- -------------------------------------------------------
-- 2. Rename FK columns in every child table
-- -------------------------------------------------------
ALTER TABLE fitment_jobs                    RENAME COLUMN fitment_centre_id TO fitment_id;
ALTER TABLE orders                          RENAME COLUMN fitment_centre_id TO fitment_id;
ALTER TABLE fitter_earnings                 RENAME COLUMN fitment_centre_id TO fitment_id;
ALTER TABLE fitter_pricing                  RENAME COLUMN fitment_centre_id TO fitment_id;
ALTER TABLE fitment_centre_payouts          RENAME COLUMN fitment_centre_id TO fitment_id;
ALTER TABLE fitment_centre_bank_details     RENAME COLUMN fitment_centre_id TO fitment_id;
ALTER TABLE fitment_centre_compliance_docs  RENAME COLUMN fitment_centre_id TO fitment_id;

-- -------------------------------------------------------
-- 3. Recreate trigger function — references NEW.fitment_centre_id
--    (stored as text, must be rewritten manually)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION create_earnings_on_job_complete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.job_status = 'completed' AND (OLD.job_status IS NULL OR OLD.job_status <> 'completed') THEN
    INSERT INTO fitter_earnings (fitment_id, job_id, customer_name, amount, status)
    VALUES (NEW.fitment_id, NEW.job_id, NEW.customer_name,
            COALESCE(NEW.earnings_amount, 0), 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------
-- 4. Recreate RLS policies that reference fitment_centre_id
--    (Postgres policy SQL is stored as text — column renames
--     do NOT automatically update policy expressions)
-- -------------------------------------------------------

-- fitment_jobs
DROP POLICY IF EXISTS "fitters_own_jobs" ON fitment_jobs;
CREATE POLICY "fitters_own_jobs" ON fitment_jobs
  FOR ALL USING (
    fitment_id IN (SELECT fitment_id FROM fitment_centres WHERE user_id = auth.uid())
  );

-- fitter_pricing
DROP POLICY IF EXISTS "fitters_own_pricing" ON fitter_pricing;
CREATE POLICY "fitters_own_pricing" ON fitter_pricing
  FOR ALL USING (
    fitment_id IN (SELECT fitment_id FROM fitment_centres WHERE user_id = auth.uid())
  );

-- fitter_earnings
DROP POLICY IF EXISTS "fitters_own_earnings" ON fitter_earnings;
CREATE POLICY "fitters_own_earnings" ON fitter_earnings
  FOR ALL USING (
    fitment_id IN (SELECT fitment_id FROM fitment_centres WHERE user_id = auth.uid())
  );

-- fitment_centre_payouts
DROP POLICY IF EXISTS "fitters_read_own_payouts" ON fitment_centre_payouts;
CREATE POLICY "fitters_read_own_payouts" ON fitment_centre_payouts
  FOR SELECT USING (
    fitment_id IN (SELECT fitment_id FROM fitment_centres WHERE user_id = auth.uid())
  );

-- fitment_centre_bank_details
DROP POLICY IF EXISTS "fitters_read_own_bank_details" ON fitment_centre_bank_details;
CREATE POLICY "fitters_read_own_bank_details" ON fitment_centre_bank_details
  FOR ALL USING (
    fitment_id IN (SELECT fitment_id FROM fitment_centres WHERE user_id = auth.uid())
  );

-- fitment_centre_compliance_docs
DROP POLICY IF EXISTS "fitters_read_own_compliance" ON fitment_centre_compliance_docs;
CREATE POLICY "fitters_read_own_compliance" ON fitment_centre_compliance_docs
  FOR SELECT USING (
    fitment_id IN (SELECT fitment_id FROM fitment_centres WHERE user_id = auth.uid())
  );

-- -------------------------------------------------------
-- 5. payment_status enum — add spec-compliant values,
--    backfill existing rows to spec values
-- -------------------------------------------------------
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'unpaid';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- Enum values can only be committed before UPDATE uses them
COMMIT;

BEGIN;

-- Backfill: map legacy values → spec values
UPDATE orders SET payment_status = 'paid'   WHERE payment_status::text = 'success';
UPDATE orders SET payment_status = 'unpaid' WHERE payment_status::text IN ('pending', 'failed');

-- -------------------------------------------------------
-- 6. Drop/recreate indexes that reference old column names
--    (Postgres auto-updates index column references on rename,
--     but any index whose NAME implies the old column is stale —
--     recreating here for clarity and any that were missed)
-- -------------------------------------------------------
DROP INDEX IF EXISTS idx_fitment_jobs_centre;
DROP INDEX IF EXISTS idx_fitment_jobs_status;
DROP INDEX IF EXISTS idx_fitment_jobs_scheduled;
DROP INDEX IF EXISTS idx_fitter_earnings_centre;
DROP INDEX IF EXISTS idx_fitter_pricing_centre;
DROP INDEX IF EXISTS idx_payouts_centre;
DROP INDEX IF EXISTS idx_compliance_centre;
DROP INDEX IF EXISTS idx_bank_details_centre;
DROP INDEX IF EXISTS idx_orders_fulfillment_status;
DROP INDEX IF EXISTS idx_orders_delivery_method;

CREATE INDEX idx_fitment_jobs_centre    ON fitment_jobs (fitment_id);
CREATE INDEX idx_fitment_jobs_scheduled ON fitment_jobs (fitment_id, scheduled_date);
CREATE INDEX idx_fitter_earnings_centre ON fitter_earnings (fitment_id);
CREATE INDEX idx_fitter_pricing_centre  ON fitter_pricing (fitment_id);
CREATE INDEX idx_payouts_centre         ON fitment_centre_payouts (fitment_id, created_at DESC);
CREATE INDEX idx_compliance_centre      ON fitment_centre_compliance_docs (fitment_id);
CREATE INDEX idx_bank_details_centre    ON fitment_centre_bank_details (fitment_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_type   ON orders (order_type);

COMMIT;
