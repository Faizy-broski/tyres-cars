-- =============================================================================
-- Simplify to a core tyre e-commerce schema.
-- Drops every table/column that only existed to support fitment-centre booking,
-- the fitter portal, wheels, vehicle fitment lookup, suppliers/purchase-orders,
-- warehouses, shipping/shipments, promotions, and customer pricing groups.
-- Keeps: brands, patterns, skus, categories, collections, product_prices,
--        product_stock (single stock number per SKU, no warehouse dimension),
--        profiles, customers, addresses, orders, order_items, order_payments,
--        order_activity, notifications.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1 — Drop views that depend on tables we're about to drop
-- =============================================================================

DROP VIEW IF EXISTS fitment_centres_with_users CASCADE;

-- =============================================================================
-- SECTION 2 — Drop columns on kept tables that reference dropped tables
-- =============================================================================

ALTER TABLE orders
  DROP COLUMN IF EXISTS fitment_centre_id CASCADE,
  DROP COLUMN IF EXISTS order_type        CASCADE,
  DROP COLUMN IF EXISTS fulfilment_type   CASCADE,
  DROP COLUMN IF EXISTS warehouse_id      CASCADE,
  DROP COLUMN IF EXISTS shipping_address_id CASCADE,
  DROP COLUMN IF EXISTS shipping_cost     CASCADE,
  DROP COLUMN IF EXISTS fitting_cost      CASCADE,
  DROP COLUMN IF EXISTS wheel_alignment_type CASCADE;

ALTER TABLE order_items
  DROP COLUMN IF EXISTS product_type      CASCADE,
  DROP COLUMN IF EXISTS warehouse_id      CASCADE,
  DROP COLUMN IF EXISTS supplier_id       CASCADE,
  DROP COLUMN IF EXISTS fulfilment_source CASCADE,
  DROP COLUMN IF EXISTS reserved_qty      CASCADE;

ALTER TABLE product_prices
  DROP COLUMN IF EXISTS customer_group_id CASCADE,
  DROP COLUMN IF EXISTS warehouse_id      CASCADE;

ALTER TABLE customers
  DROP COLUMN IF EXISTS customer_type      CASCADE,
  DROP COLUMN IF EXISTS account_status     CASCADE,
  DROP COLUMN IF EXISTS credit_limit       CASCADE,
  DROP COLUMN IF EXISTS payment_terms      CASCADE,
  DROP COLUMN IF EXISTS customer_group_id  CASCADE,
  DROP COLUMN IF EXISTS billing_address_id CASCADE;

-- product_stock: collapse from per-warehouse rows to one row per SKU
ALTER TABLE product_stock
  DROP COLUMN IF EXISTS warehouse_id CASCADE;

DO $$ BEGIN
  ALTER TABLE product_stock ADD CONSTRAINT product_stock_product_id_key UNIQUE (product_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- =============================================================================
-- SECTION 3 — Drop the extra feature tables entirely
-- =============================================================================

-- Fitment-centre booking & fitter portal
DROP TABLE IF EXISTS fitment_centre_compliance_docs CASCADE;
DROP TABLE IF EXISTS fitment_centre_bank_details     CASCADE;
DROP TABLE IF EXISTS fitment_centre_payouts          CASCADE;
DROP TABLE IF EXISTS fitter_earnings                 CASCADE;
DROP TABLE IF EXISTS fitter_pricing                  CASCADE;
DROP TABLE IF EXISTS fitment_job_items               CASCADE;
DROP TABLE IF EXISTS fitment_jobs                    CASCADE;
DROP TABLE IF EXISTS fitter_applications             CASCADE;
DROP TABLE IF EXISTS fitment_centres                 CASCADE;

-- Wheels (separate product line)
DROP TABLE IF EXISTS wheel_variants CASCADE;
DROP TABLE IF EXISTS wheels         CASCADE;
DROP TABLE IF EXISTS wheel_brands   CASCADE;

-- Vehicle fitment lookup
DROP TABLE IF EXISTS vehicle_tyre_fitments  CASCADE;
DROP TABLE IF EXISTS vehicle_wheel_fitments CASCADE;
DROP TABLE IF EXISTS vehicles               CASCADE;

-- Suppliers / purchase orders / warehouses / fulfilment ops
DROP TABLE IF EXISTS supplier_product_map   CASCADE;
DROP TABLE IF EXISTS supplier_product_stock CASCADE;
DROP TABLE IF EXISTS purchase_order_items   CASCADE;
DROP TABLE IF EXISTS purchase_orders        CASCADE;
DROP TABLE IF EXISTS suppliers              CASCADE;
DROP TABLE IF EXISTS order_shipment_items   CASCADE;
DROP TABLE IF EXISTS order_shipments        CASCADE;
DROP TABLE IF EXISTS shipments              CASCADE;
DROP TABLE IF EXISTS shipping_quotes        CASCADE;
DROP TABLE IF EXISTS shipping_methods       CASCADE;
DROP TABLE IF EXISTS warehouses             CASCADE;

-- Marketing / pricing-tier extras
DROP TABLE IF EXISTS promotions             CASCADE;
DROP TABLE IF EXISTS customer_group_members CASCADE;
DROP TABLE IF EXISTS customer_groups        CASCADE;

-- Search logging
DROP TABLE IF EXISTS product_search_logs CASCADE;

-- =============================================================================
-- SECTION 4 — Drop enums that only existed for the removed tables
-- =============================================================================

DROP TYPE IF EXISTS warehouse_type;
DROP TYPE IF EXISTS supplier_type;
DROP TYPE IF EXISTS stock_access_type;
DROP TYPE IF EXISTS po_status;
DROP TYPE IF EXISTS clearance_status;
DROP TYPE IF EXISTS fitment_approved_status;
DROP TYPE IF EXISTS service_type;
DROP TYPE IF EXISTS discount_type;
DROP TYPE IF EXISTS promotion_applies_to;
DROP TYPE IF EXISTS wheel_style_category;
-- address_owner_type is kept: addresses.owner_type still uses it (values are
-- just conventionally restricted to 'customer' by the app now).
DROP TYPE IF EXISTS order_type;
DROP TYPE IF EXISTS fulfilment_type;
DROP TYPE IF EXISTS order_product_type;
DROP TYPE IF EXISTS fulfilment_source;
DROP TYPE IF EXISTS shipping_method_type;
DROP TYPE IF EXISTS job_status;
DROP TYPE IF EXISTS shipment_status;
DROP TYPE IF EXISTS customer_type;
DROP TYPE IF EXISTS account_status;

-- =============================================================================
-- SECTION 5 — Redefine RPC functions used by the simplified backend
-- =============================================================================

CREATE OR REPLACE FUNCTION decrement_stock_batch(p_items JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE product_stock ps
  SET available_stock = GREATEST(available_stock - (item->>'quantity')::INTEGER, 0)
  FROM jsonb_array_elements(p_items) AS item
  WHERE ps.product_id = (item->>'product_id')::UUID;
END;
$$;

CREATE OR REPLACE FUNCTION get_order_stats()
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'totalOrders',    COUNT(*),
    'totalRevenue',   COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0),
    'avgOrderSize',   COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0),
    'pendingPayment', COUNT(*) FILTER (WHERE payment_status <> 'paid')
  )
  FROM orders;
$$;

CREATE OR REPLACE FUNCTION get_customer_stats()
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'totalCustomers', (SELECT COUNT(*) FROM customers),
    'totalOrders',    (SELECT COUNT(*) FROM orders),
    'avgOrderSize',   COALESCE((SELECT AVG(total_amount) FROM orders WHERE payment_status = 'paid'), 0),
    'totalRevenue',   COALESCE((SELECT SUM(total_amount) FROM orders WHERE payment_status = 'paid'), 0)
  );
$$;

COMMIT;
