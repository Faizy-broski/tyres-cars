import { Router } from 'express'
import { supabase as db } from '../services/supabase.service'

const router = Router()

// GET /api/products/slug/:slug — public product detail by product_slug
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params as { slug: string }

    const { data: sku, error } = await db
      .from('skus')
      .select(`
        product_id,
        sku,
        product_slug,
        tyre_size_display,
        status,
        width,
        profile,
        rim_size,
        speed_rating,
        load_index,
        runflat,
        xl_reinforced,
        ply_rating,
        load_range,
        construction_type,
        sidewall,
        country_of_origin,
        overall_diameter,
        tread_depth,
        tyre_weight,
        e_mark,
        utqg,
        fuel_rating,
        wet_grip,
        noise_db,
        noise_class,
        variant_images,
        total_available_stock,
        pattern_id,
        brand_id,
        patterns!inner (
          pattern_id,
          pattern_name,
          pattern_slug,
          pattern_short_description,
          application_type,
          gallery_images,
          brands ( brand_name, brand_slug )
        ),
        product_prices ( price_type, price_inc_gst, price_ex_gst ),
        product_stock ( available_stock, reserved_stock )
      `)
      .eq('product_slug', slug)
      .eq('status', 'active')
      .single()

    if (error || !sku) return res.status(404).json({ error: 'Product not found' })

    const pattern = (sku as any).patterns
    const brand   = pattern?.brands

    // Sibling SKUs (same pattern, active)
    const { data: siblings } = await db
      .from('skus')
      .select('product_id, product_slug, tyre_size_display, width, profile, rim_size, total_available_stock')
      .eq('pattern_id', sku.pattern_id)
      .eq('status', 'active')
      .neq('product_id', sku.product_id)
      .order('width').order('profile').order('rim_size')

    // Retail price = the base public price
    const retail_price = ((sku as any).product_prices ?? [])
      .find((p: any) => p.price_type === 'retail')
      ?.price_inc_gst ?? null

    res.json({
      ...sku,
      brand_name:  brand?.brand_name  ?? null,
      brand_slug:  brand?.brand_slug  ?? null,
      pattern_name: pattern?.pattern_name ?? null,
      pattern_slug: pattern?.pattern_slug ?? null,
      pattern_short_description: pattern?.pattern_short_description ?? null,
      application_type: pattern?.application_type ?? null,
      gallery_images:   pattern?.gallery_images   ?? [],
      retail_price,
      siblings: siblings ?? [],
    })
  } catch (err) { next(err) }
})

export default router
