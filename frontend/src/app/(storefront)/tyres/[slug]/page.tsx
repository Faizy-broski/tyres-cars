import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProductDetailClient from '@/components/storefront/ProductDetailClient'

export const revalidate = 600

interface Props {
  params: Promise<{ slug: string }>
}


export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('skus')
    .select('tyre_size_display, patterns(pattern_name, pattern_short_description, brands(brand_name))')
    .eq('product_slug', slug)
    .eq('status', 'active')
    .limit(1)

  const row = data?.[0]
  if (!row) return { title: 'Tyre Not Found' }

  const pattern = row.patterns as { pattern_name?: string; pattern_short_description?: string; brands?: { brand_name?: string } } | null
  const brand   = (pattern as any)?.brands

  return {
    title:       `${brand?.brand_name ?? ''} ${(pattern as any)?.pattern_name ?? ''} ${row.tyre_size_display ?? ''}`.trim(),
    description: (pattern as any)?.pattern_short_description ?? undefined,
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params

  // connection() opts this page out of static prerendering so price/stock are always live
  await connection()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('skus')
    .select(`
      product_id,
      sku,
      product_slug,
      tyre_size_display,
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
      compare_at_price,
      pattern_id,
      brand_id,
      patterns (
        pattern_name,
        pattern_slug,
        pattern_short_description,
        application_type,
        gallery_images,
        is_active,
        show_on_website,
        brands ( brand_name, brand_slug, is_active, show_on_website )
      ),
      product_prices ( price_type, price_inc_gst )
    `)
    .eq('product_slug', slug)
    .eq('status', 'active')
    .limit(1)

  const skuRaw = data?.[0] ?? null
  if (error || !skuRaw) notFound()

  const sku     = skuRaw as any
  const pattern = sku.patterns
  const brand   = pattern?.brands

  // Enforce storefront visibility — pattern and brand must both be active and published
  if (!pattern?.is_active || !pattern?.show_on_website) notFound()
  if (!brand?.is_active || !brand?.show_on_website) notFound()

  const { data: siblings } = await supabase
    .from('skus')
    .select('product_id, product_slug, tyre_size_display, width, profile, rim_size, total_available_stock')
    .eq('pattern_id', sku.pattern_id)
    .eq('status', 'active')
    .neq('product_id', sku.product_id)
    .order('width').order('profile').order('rim_size')

  const retail_price = (sku.product_prices ?? [])
    .find((p: { price_type: string }) => p.price_type === 'retail')
    ?.price_inc_gst ?? null

  // Promotions feature has been removed — no promo pricing is computed.
  const promo_price: number | null = null

  const product = {
    ...sku,
    brand_name:                brand?.brand_name                   ?? null,
    brand_slug:                brand?.brand_slug                   ?? null,
    pattern_name:              pattern?.pattern_name               ?? null,
    pattern_slug:              pattern?.pattern_slug               ?? null,
    pattern_short_description: pattern?.pattern_short_description  ?? null,
    application_type:          pattern?.application_type           ?? null,
    gallery_images:            pattern?.gallery_images             ?? [],
    retail_price,
    promo_price,
    compare_at_price:          sku.compare_at_price ?? null,
    siblings: siblings ?? [],
  }

  return <ProductDetailClient product={product} />
}
