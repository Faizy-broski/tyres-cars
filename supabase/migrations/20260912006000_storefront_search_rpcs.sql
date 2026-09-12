-- =============================================================================
-- Storefront search RPCs: search_tyres() and get_tyre_facets()
-- Called from frontend/src/lib/supabase/search.ts, GlobalSearchBar.tsx and
-- TyreCarousel.tsx via supabase.rpc(...) using the anon key.
--
-- Recovered from the live database's applied-migration history (this project
-- had these functions applied directly and never committed to this repo),
-- then rewritten to match the simplified schema: promotions and
-- product_prices.customer_group_id no longer exist, so promo pricing is
-- gone and the retail price lookup no longer filters on customer group.
--
-- Both functions are SECURITY DEFINER with a pinned search_path so they run
-- with the function owner's privileges and bypass RLS — safe here because
-- both hard-filter to public-safe, active/published rows only. Function
-- EXECUTE privilege defaults to REVOKEd from PUBLIC on this project, so it
-- must be granted explicitly to anon/authenticated.
-- =============================================================================

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DROP FUNCTION IF EXISTS public.search_tyres(
  text, numeric, numeric, numeric, uuid, boolean, boolean, text, text,
  numeric, numeric, text, text, integer, integer
);

CREATE OR REPLACE FUNCTION public.search_tyres(
  p_q          text    DEFAULT NULL,
  p_width      numeric DEFAULT NULL,
  p_profile    numeric DEFAULT NULL,
  p_rim_size   numeric DEFAULT NULL,
  p_brand_id   uuid    DEFAULT NULL,
  p_runflat    boolean DEFAULT NULL,
  p_xl         boolean DEFAULT NULL,
  p_speed      text    DEFAULT NULL,
  p_app_type   text    DEFAULT NULL,
  p_price_min  numeric DEFAULT NULL,
  p_price_max  numeric DEFAULT NULL,
  p_terrain    text    DEFAULT NULL,
  p_sort       text    DEFAULT 'updated_at_desc',
  p_page       integer DEFAULT 1,
  p_limit      integer DEFAULT 24
)
RETURNS TABLE (
  product_id        uuid,
  sku               text,
  product_slug      text,
  tyre_size_display text,
  brand_id          uuid,
  brand_name        text,
  brand_slug        text,
  brand_logo        text,
  brand_positioning brand_positioning_type,
  pattern_id        uuid,
  pattern_name      text,
  pattern_slug      text,
  main_image        text,
  width             numeric,
  profile           numeric,
  rim_size          numeric,
  speed_rating      text,
  runflat           boolean,
  xl_reinforced     boolean,
  total_stock       integer,
  price_inc_gst     numeric,
  promo_price       numeric,
  total_count       bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      s.product_id,
      s.sku,
      s.product_slug,
      s.tyre_size_display,
      s.brand_id,
      b.brand_name,
      b.brand_slug,
      b.brand_logo,
      b.brand_positioning,
      s.pattern_id,
      p.pattern_name,
      p.pattern_slug,
      p.main_image,
      s.width,
      s.profile,
      s.rim_size,
      s.speed_rating,
      s.runflat,
      s.xl_reinforced,
      s.total_available_stock AS total_stock,
      s.updated_at,
      (
        SELECT pp.price_inc_gst
        FROM product_prices pp
        WHERE pp.product_id = s.product_id
          AND pp.price_type = 'retail'
          AND pp.is_active
        LIMIT 1
      ) AS price_inc_gst
    FROM skus s
    JOIN patterns p ON p.pattern_id = s.pattern_id AND p.is_active AND p.show_on_website
    JOIN brands   b ON b.brand_id   = s.brand_id   AND b.is_active AND b.show_on_website
    WHERE s.status = 'active'
      AND (p_width    IS NULL OR s.width    = p_width)
      AND (p_profile  IS NULL OR s.profile  = p_profile)
      AND (p_rim_size IS NULL OR s.rim_size = p_rim_size)
      AND (p_brand_id IS NULL OR s.brand_id = p_brand_id)
      AND (p_runflat  IS NULL OR s.runflat  = p_runflat)
      AND (p_xl       IS NULL OR s.xl_reinforced = p_xl)
      AND (p_speed    IS NULL OR s.speed_rating = p_speed)
      AND (p_app_type IS NULL OR p.application_type::text = p_app_type)
      AND (p_terrain  IS NULL OR p.terrain_type::text = p_terrain)
      AND (
        p_q IS NULL OR p_q = '' OR (
          s.sku ILIKE '%' || p_q || '%'
          OR s.tyre_size_display ILIKE '%' || p_q || '%'
          OR p.pattern_name ILIKE '%' || p_q || '%'
          OR b.brand_name ILIKE '%' || p_q || '%'
        )
      )
  ),
  final AS (
    SELECT base.*, NULL::numeric AS promo_price
    FROM base
  )
  SELECT
    final.product_id,
    final.sku,
    final.product_slug,
    final.tyre_size_display,
    final.brand_id,
    final.brand_name,
    final.brand_slug,
    final.brand_logo,
    final.brand_positioning,
    final.pattern_id,
    final.pattern_name,
    final.pattern_slug,
    final.main_image,
    final.width,
    final.profile,
    final.rim_size,
    final.speed_rating,
    final.runflat,
    final.xl_reinforced,
    final.total_stock,
    final.price_inc_gst,
    final.promo_price,
    COUNT(*) OVER() AS total_count
  FROM final
  WHERE (p_price_min IS NULL OR final.price_inc_gst >= p_price_min)
    AND (p_price_max IS NULL OR final.price_inc_gst <= p_price_max)
  ORDER BY
    CASE WHEN p_sort = 'price_asc'  THEN final.price_inc_gst END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN final.price_inc_gst END DESC NULLS LAST,
    CASE WHEN p_sort = 'stock_desc' THEN final.total_stock END DESC NULLS LAST,
    final.updated_at DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_page - 1, 0) * GREATEST(p_limit, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_tyres(
  text, numeric, numeric, numeric, uuid, boolean, boolean, text, text,
  numeric, numeric, text, text, integer, integer
) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_tyre_facets(numeric, numeric, numeric, uuid);

CREATE OR REPLACE FUNCTION public.get_tyre_facets(
  p_width    numeric DEFAULT NULL,
  p_profile  numeric DEFAULT NULL,
  p_rim_size numeric DEFAULT NULL,
  p_brand_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH base AS (
    SELECT
      s.width,
      s.profile,
      s.rim_size,
      s.brand_id,
      b.brand_name,
      b.brand_slug,
      p.terrain_type,
      (
        SELECT pp.price_inc_gst
        FROM product_prices pp
        WHERE pp.product_id = s.product_id
          AND pp.price_type = 'retail'
          AND pp.is_active
        LIMIT 1
      ) AS price_inc_gst
    FROM skus s
    JOIN patterns p ON p.pattern_id = s.pattern_id AND p.is_active AND p.show_on_website
    JOIN brands   b ON b.brand_id   = s.brand_id   AND b.is_active AND b.show_on_website
    WHERE s.status = 'active'
      AND (p_width    IS NULL OR s.width    = p_width)
      AND (p_profile  IS NULL OR s.profile  = p_profile)
      AND (p_rim_size IS NULL OR s.rim_size = p_rim_size)
      AND (p_brand_id IS NULL OR s.brand_id = p_brand_id)
  )
  SELECT jsonb_build_object(
    'widths',      COALESCE((SELECT jsonb_agg(DISTINCT width    ORDER BY width)    FROM base), '[]'::jsonb),
    'profiles',    COALESCE((SELECT jsonb_agg(DISTINCT profile  ORDER BY profile)  FROM base), '[]'::jsonb),
    'rim_sizes',   COALESCE((SELECT jsonb_agg(DISTINCT rim_size ORDER BY rim_size) FROM base), '[]'::jsonb),
    'brands',      COALESCE((
                     SELECT jsonb_agg(DISTINCT jsonb_build_object(
                       'brand_id',   brand_id,
                       'brand_name', brand_name,
                       'brand_slug', brand_slug
                     ))
                     FROM base
                   ), '[]'::jsonb),
    'price_range', jsonb_build_object(
                     'min', (SELECT MIN(price_inc_gst) FROM base),
                     'max', (SELECT MAX(price_inc_gst) FROM base)
                   ),
    'terrains',    COALESCE((
                     SELECT jsonb_agg(DISTINCT terrain_type::text)
                     FROM base
                     WHERE terrain_type IS NOT NULL
                   ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tyre_facets(numeric, numeric, numeric, uuid) TO anon, authenticated;

COMMIT;
