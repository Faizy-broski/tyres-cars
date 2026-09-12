-- =============================================================================
-- Core dummy data seed — super admin, sample customers, tyre catalogue, orders.
-- Safe to re-run (deterministic UUIDs via uuid_generate_v5, ON CONFLICT guards).
--
-- LOGIN CREDENTIALS
-- -----------------------------------------------------------------------------
--   Super Admin
--     Email:    admin@tyrevault.dev
--     Password: Admin@12345
--
--   Sample customers (all use the same password for convenience)
--     Email:    john.doe@example.com     | Password: Customer@12345
--     Email:    jane.smith@example.com   | Password: Customer@12345
--     Email:    alex.wong@example.com    | Password: Customer@12345
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1 — Auth users + profiles
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Super admin ──────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES (
  extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/user/admin@tyrevault.dev'),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin@tyrevault.dev',
  extensions.crypt('Admin@12345', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{"first_name":"Store","last_name":"Admin"}',
  now(), now(),
  '', '', '', ''
)
ON CONFLICT (id) DO UPDATE
  SET encrypted_password = extensions.crypt('Admin@12345', extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
      updated_at         = now();

INSERT INTO profiles (id, role, created_at, updated_at)
VALUES (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/user/admin@tyrevault.dev'), 'super_admin', now(), now())
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', updated_at = now();

-- ── Sample customers ─────────────────────────────────────────────────────────
DO $$
DECLARE
  cust RECORD;
BEGIN
  FOR cust IN
    SELECT * FROM (VALUES
      ('john.doe@example.com',   'John',  'Doe',   '0400111222'),
      ('jane.smith@example.com', 'Jane',  'Smith', '0400333444'),
      ('alex.wong@example.com',  'Alex',  'Wong',  '0400555666')
    ) AS t(email, first_name, last_name, phone)
  LOOP
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/user/' || cust.email),
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      cust.email,
      extensions.crypt('Customer@12345', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('first_name', cust.first_name, 'last_name', cust.last_name),
      now(), now(),
      '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE
      SET encrypted_password = extensions.crypt('Customer@12345', extensions.gen_salt('bf')),
          email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
          updated_at         = now();

    INSERT INTO profiles (id, role, created_at, updated_at)
    VALUES (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/user/' || cust.email), 'customer', now(), now())
    ON CONFLICT (id) DO UPDATE SET role = 'customer', updated_at = now();

    INSERT INTO customers (customer_id, profile_id, email, first_name, last_name, phone, created_at, updated_at)
    VALUES (
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/customer/' || cust.email),
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/user/' || cust.email),
      cust.email, cust.first_name, cust.last_name, cust.phone,
      now(), now()
    )
    ON CONFLICT (email) DO UPDATE
      SET profile_id = EXCLUDED.profile_id, first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name, phone = EXCLUDED.phone, updated_at = now();

    -- Home address for each customer
    INSERT INTO addresses (
      address_id, owner_type, owner_id, customer_id, address_name,
      address_line1, address_line_1, address_line2, address_line_2,
      city, suburb, state, postal_code, postcode, country,
      phone, is_default, created_at
    )
    VALUES (
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/address/' || cust.email),
      'customer',
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/customer/' || cust.email),
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/customer/' || cust.email),
      'Home',
      '123 Example Street', '123 Example Street', NULL, NULL,
      'Brisbane', 'Brisbane', 'QLD', '4000', '4000', 'Australia',
      cust.phone, TRUE, now()
    )
    ON CONFLICT (address_id) DO NOTHING;
  END LOOP;
END $$;

-- A guest customer (no auth account) so the admin customer list shows both kinds
INSERT INTO customers (customer_id, profile_id, email, first_name, last_name, phone, created_at, updated_at)
VALUES (
  extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/customer/guest.buyer@example.com'),
  NULL, 'guest.buyer@example.com', 'Guest', 'Buyer', '0400777888', now(), now()
)
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- SECTION 2 — Tyre catalogue (brands, patterns, categories, skus, prices, stock)
-- =============================================================================

INSERT INTO categories (category_id, category_name, category_slug, category_type, is_active, sort_order, created_at)
VALUES
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/category/summer'),     'Summer',     'summer',     'season',      TRUE, 1, now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/category/all-season'), 'All Season', 'all-season', 'season',      TRUE, 2, now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/category/suv'),        'SUV',        'suv',        'application', TRUE, 3, now())
ON CONFLICT (category_slug) DO NOTHING;

INSERT INTO collections (collection_id, collection_name, collection_slug, description, is_active, created_at)
VALUES (
  extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/collection/best-sellers'),
  'Best Sellers', 'best-sellers', 'Our most popular tyres', TRUE, now()
)
ON CONFLICT (collection_slug) DO NOTHING;

INSERT INTO brands (brand_id, brand_name, brand_slug, brand_description, country_of_brand, is_active, show_on_website, created_at, updated_at)
VALUES
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/michelin'),   'Michelin',   'michelin',   'Premium French tyre manufacturer.',  'France',       TRUE, TRUE, now(), now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/bridgestone'),'Bridgestone','bridgestone','Leading Japanese tyre manufacturer.', 'Japan',        TRUE, TRUE, now(), now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/goodyear'),   'Goodyear',   'goodyear',   'Trusted American tyre brand.',       'United States',TRUE, TRUE, now(), now())
ON CONFLICT (brand_slug) DO NOTHING;

-- Patterns (2 per brand)
INSERT INTO patterns (
  pattern_id, brand_id, pattern_name, pattern_slug, pattern_short_description,
  main_image, application_type, season_type, collection_id,
  is_active, show_on_website, discountable, created_at, updated_at
)
VALUES
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/michelin-primacy-4'),
   extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/michelin'),
   'Primacy 4', 'primacy-4', 'Long-lasting wet grip for passenger cars.',
   NULL, 'PCR', 'all_season', extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/collection/best-sellers'),
   TRUE, TRUE, TRUE, now(), now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/michelin-pilot-sport-4'),
   extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/michelin'),
   'Pilot Sport 4', 'pilot-sport-4', 'High-performance summer tyre for sports cars.',
   NULL, 'PCR', 'summer', NULL,
   TRUE, TRUE, TRUE, now(), now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/bridgestone-dueler-ht'),
   extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/bridgestone'),
   'Dueler H/T', 'dueler-ht', 'All-terrain comfort and durability for SUVs.',
   NULL, '4x4', 'all_season', NULL,
   TRUE, TRUE, TRUE, now(), now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/bridgestone-turanza-t005'),
   extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/bridgestone'),
   'Turanza T005', 'turanza-t005', 'Quiet, comfortable touring tyre.',
   NULL, 'PCR', 'all_season', NULL,
   TRUE, TRUE, TRUE, now(), now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/goodyear-eagle-f1'),
   extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/goodyear'),
   'Eagle F1 Asymmetric 5', 'eagle-f1-asymmetric-5', 'Sporty handling with confident braking.',
   NULL, 'PCR', 'summer', extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/collection/best-sellers'),
   TRUE, TRUE, TRUE, now(), now()),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/goodyear-wrangler'),
   extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/goodyear'),
   'Wrangler AT/SA', 'wrangler-at-sa', 'Rugged all-terrain tyre for 4x4s.',
   NULL, '4x4', 'all_season', NULL,
   TRUE, TRUE, TRUE, now(), now())
ON CONFLICT (brand_id, pattern_slug) DO NOTHING;

INSERT INTO pattern_categories (pattern_id, category_id)
VALUES
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/michelin-primacy-4'),      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/category/all-season')),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/michelin-pilot-sport-4'),  extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/category/summer')),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/bridgestone-dueler-ht'),   extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/category/suv')),
  (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/goodyear-wrangler'),       extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/category/suv'))
ON CONFLICT DO NOTHING;

-- SKUs — 2 sizes per pattern, with retail price + stock
DO $$
DECLARE
  sku_row RECORD;
  sku_uuid UUID;
BEGIN
  FOR sku_row IN
    SELECT * FROM (VALUES
      ('michelin-primacy-4',           'michelin',    '205/55R16', 205, 55, 16, 'MICH-PR4-205-55-16', 189.00, 40),
      ('michelin-primacy-4',           'michelin',    '215/60R16', 215, 60, 16, 'MICH-PR4-215-60-16', 199.00, 25),
      ('michelin-pilot-sport-4',       'michelin',    '225/45R17', 225, 45, 17, 'MICH-PS4-225-45-17', 259.00, 18),
      ('michelin-pilot-sport-4',       'michelin',    '235/40R18', 235, 40, 18, 'MICH-PS4-235-40-18', 289.00, 12),
      ('bridgestone-dueler-ht',        'bridgestone', '265/65R17', 265, 65, 17, 'BRDG-DHT-265-65-17', 249.00, 30),
      ('bridgestone-dueler-ht',        'bridgestone', '265/60R18', 265, 60, 18, 'BRDG-DHT-265-60-18', 269.00, 20),
      ('bridgestone-turanza-t005',     'bridgestone', '195/65R15', 195, 65, 15, 'BRDG-TT5-195-65-15', 159.00, 50),
      ('bridgestone-turanza-t005',     'bridgestone', '205/60R16', 205, 60, 16, 'BRDG-TT5-205-60-16', 175.00, 35),
      ('goodyear-eagle-f1',            'goodyear',    '225/40R18', 225, 40, 18, 'GOOD-EF1-225-40-18', 279.00, 15),
      ('goodyear-eagle-f1',            'goodyear',    '245/35R19', 245, 35, 19, 'GOOD-EF1-245-35-19', 319.00, 8),
      ('goodyear-wrangler',            'goodyear',    '265/70R16', 265, 70, 16, 'GOOD-WAT-265-70-16', 229.00, 22),
      ('goodyear-wrangler',            'goodyear',    '245/75R16', 245, 75, 16, 'GOOD-WAT-245-75-16', 219.00, 28)
    ) AS t(pattern_slug, brand_slug, size_display, width, profile, rim_size, sku, price_inc_gst, stock)
  LOOP
    sku_uuid := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/sku/' || sku_row.sku);

    INSERT INTO skus (
      product_id, sku, brand_id, pattern_id, tyre_size_display, normalized_size_code,
      width, profile, rim_size, country_of_origin, status,
      total_available_stock, product_slug, created_at, updated_at
    )
    VALUES (
      sku_uuid, sku_row.sku,
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/brand/' || sku_row.brand_slug),
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/pattern/' || sku_row.pattern_slug),
      sku_row.size_display,
      regexp_replace(sku_row.size_display, '[^0-9]', '', 'g'),
      sku_row.width, sku_row.profile, sku_row.rim_size,
      'Japan', 'active',
      0, sku_row.sku || '-' || lower(regexp_replace(sku_row.size_display, '[^a-zA-Z0-9]', '', 'g')),
      now(), now()
    )
    ON CONFLICT (sku) DO NOTHING;

    INSERT INTO product_prices (price_id, product_id, price_type, price_ex_gst, price_inc_gst, is_active, created_at, updated_at)
    VALUES (
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/price/' || sku_row.sku),
      sku_uuid, 'retail',
      round(sku_row.price_inc_gst / 1.1, 2), sku_row.price_inc_gst,
      TRUE, now(), now()
    )
    ON CONFLICT (price_id) DO NOTHING;

    INSERT INTO product_stock (stock_id, product_id, available_stock, reserved_stock, minimum_stock_level, created_at, updated_at)
    VALUES (
      extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/stock/' || sku_row.sku),
      sku_uuid, sku_row.stock, 0, 5, now(), now()
    )
    ON CONFLICT (product_id) DO UPDATE SET available_stock = EXCLUDED.available_stock;
  END LOOP;
END $$;

-- =============================================================================
-- SECTION 3 — Sample orders for john.doe@example.com
-- =============================================================================

DO $$
DECLARE
  cust_id   UUID := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/customer/john.doe@example.com');
  order_id_1 UUID := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order/TVT-DEMO-0001');
  order_id_2 UUID := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order/TVT-DEMO-0002');
  sku_1     UUID := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/sku/MICH-PR4-205-55-16');
  sku_2     UUID := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/sku/BRDG-DHT-265-65-17');
BEGIN
  INSERT INTO orders (
    order_id, order_number, customer_id, payment_status, order_status,
    currency, total_amount, gst_amount, discount_amount,
    shipping_address_snapshot, created_at, updated_at
  )
  VALUES (
    order_id_1, 'TVT-DEMO-0001', cust_id, 'paid', 'fulfilled',
    'AUD', 756.00, 68.73, 0,
    jsonb_build_object('line1','123 Example Street','suburb','Brisbane','state','QLD','postcode','4000'),
    now() - interval '10 days', now() - interval '8 days'
  )
  ON CONFLICT (order_id) DO NOTHING;

  INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, total_price, created_at)
  VALUES (
    extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order-item/TVT-DEMO-0001-1'),
    order_id_1, sku_1, 4, 189.00, 756.00, now() - interval '10 days'
  )
  ON CONFLICT (order_item_id) DO NOTHING;

  INSERT INTO order_payments (payment_id, order_id, payment_reference, payment_method, amount, currency, status, created_at)
  VALUES (
    extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order-payment/TVT-DEMO-0001'),
    order_id_1, 'TVT-DEMO-0001', 'stripe', 756.00, 'AUD', 'paid', now() - interval '10 days'
  )
  ON CONFLICT (payment_id) DO NOTHING;

  INSERT INTO order_activity (activity_id, order_id, event_type, description, created_at)
  VALUES
    (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order-activity/TVT-DEMO-0001-placed'),  order_id_1, 'order_placed',  'Order placed via storefront checkout', now() - interval '10 days'),
    (extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order-activity/TVT-DEMO-0001-fulfilled'), order_id_1, 'status_updated', 'Order marked fulfilled', now() - interval '8 days')
  ON CONFLICT (activity_id) DO NOTHING;

  INSERT INTO orders (
    order_id, order_number, customer_id, payment_status, order_status,
    currency, total_amount, gst_amount, discount_amount,
    shipping_address_snapshot, created_at, updated_at
  )
  VALUES (
    order_id_2, 'TVT-DEMO-0002', cust_id, 'paid', 'processing',
    'AUD', 498.00, 45.27, 0,
    jsonb_build_object('line1','123 Example Street','suburb','Brisbane','state','QLD','postcode','4000'),
    now() - interval '1 days', now() - interval '1 days'
  )
  ON CONFLICT (order_id) DO NOTHING;

  INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, total_price, created_at)
  VALUES (
    extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order-item/TVT-DEMO-0002-1'),
    order_id_2, sku_2, 2, 249.00, 498.00, now() - interval '1 days'
  )
  ON CONFLICT (order_item_id) DO NOTHING;

  INSERT INTO order_payments (payment_id, order_id, payment_reference, payment_method, amount, currency, status, created_at)
  VALUES (
    extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order-payment/TVT-DEMO-0002'),
    order_id_2, 'TVT-DEMO-0002', 'stripe', 498.00, 'AUD', 'paid', now() - interval '1 days'
  )
  ON CONFLICT (payment_id) DO NOTHING;

  INSERT INTO order_activity (activity_id, order_id, event_type, description, created_at)
  VALUES (
    extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'tyrevault/order-activity/TVT-DEMO-0002-placed'),
    order_id_2, 'order_placed', 'Order placed via storefront checkout', now() - interval '1 days'
  )
  ON CONFLICT (activity_id) DO NOTHING;
END $$;

COMMIT;
