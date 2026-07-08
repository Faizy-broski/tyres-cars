import { supabase } from './supabase.service'
import { redis, TTL } from './redis.service'
import { normalizeTyreSize } from '../utils/size-normalizer'

// Process-local cache for catalog meta data (brands, collections, categories).
// Works even when Redis is not configured. TTL in ms.
const metaCache = new Map<string, { data: unknown; exp: number }>()
function getMetaCache<T>(key: string): T | null {
  const hit = metaCache.get(key)
  return hit && hit.exp > Date.now() ? (hit.data as T) : null
}
function setMetaCache(key: string, data: unknown, ttlMs = 3_600_000) {
  metaCache.set(key, { data, exp: Date.now() + ttlMs })
}

// ============================================================
// Types
// ============================================================
export type CreateProductPayload = {
  // Basic Info
  brandId: string
  patternName: string
  patternSlug: string
  shortDescription?: string
  galleryImages?: string[]
  tyreOverview?: string
  features?: string
  warrantyInformation?: string
  tyreSpecSheet?: string
  faqList?: { question: string; answer: string }[]

  // SEO + Visibility
  defaultCountryOfOrigin?: string
  isActive?: boolean
  showOnWebsite?: boolean
  seoTitle?: string
  seoDescription?: string
  treadImage?: string

  // Categories
  discountable: boolean
  applicationType: 'PCR' | '4x4' | 'TBR'
  categoryIds?: string[]
  performanceCategory?: string
  seasonType?: string
  collectionId?: string
  tags?: string[]
  positionCategory?: 'steer' | 'drive' | 'trailer' | 'all_position'
  shoulderType?: 'open_shoulder' | 'closed_shoulder' | 'block_drive'
  terrainType?: string
  warrantyKm?: number

  // Variants
  variants: VariantPayload[]

  // Pricing (parallel array to variants, same index)
  pricing: PricingPayload[]
}

export type VariantPayload = {
  sku: string
  tyreSizeDisplay: string
  width?: number
  profile?: number
  rimSize: number
  specialSize?: string
  barcodeEan?: string
  ltSizing?: boolean
  constructionType?: string
  loadIndex?: string
  loadSpeedRating?: string
  speedRating?: string
  fuelRating?: string
  wetGrip?: string
  noiseDb?: string
  noiseClass?: string
  runflat: boolean
  xlReinforced?: boolean
  plyRating?: string
  loadRange?: string
  sidewall?: 'BSW' | 'OWL' | 'RWL'
  tubeType?: 'tubeless' | 'tube_type'
  countryOfOrigin: string
  manufacturerName?: string
  factoryName?: string
  factoryCountry?: string
  sectionWidth?: number
  treadDepth?: number
  tyreWeight?: number
  overallDiameter?: number
  maxLoad?: string
  maxPressure?: string
  eMark?: string
  dotCode?: string
  utqg?: string
  variantImages?: string[]
  status?: 'active' | 'inactive' | 'discontinued'
  replacementProductId?: string
}

export type PricingPayload = {
  priceIncGst: number
  compareAtPrice?: number
  costPrice?: number
  inventory?: number
  lowStockAlert?: number
  warehouseId?: string
}

export type ProductListFilters = {
  search?: string
  brandId?: string
  patternId?: string
  status?: string
  stock?: string
  page?: number
  limit?: number
  sortBy?: 'updated_at' | 'created_at' | 'pattern_name' | 'show_on_website' | 'brand_name' | 'variant_count'
  sortOrder?: 'asc' | 'desc'
}

// ============================================================
// LIST
// ============================================================
export async function listProducts(filters: ProductListFilters) {
  const {
    search, brandId, patternId, status = 'active', stock,
    page = 1, limit = 20, sortBy = 'updated_at', sortOrder = 'desc',
  } = filters

  // Step 1: Paginate patterns only — no SKU join keeps this fast on large datasets
  let query = supabase
    .from('patterns')
    .select(`
      pattern_id,
      pattern_name,
      pattern_slug,
      main_image,
      is_active,
      show_on_website,
      on_sale,
      collection_id,
      updated_at,
      created_at,
      brands!inner ( brand_id, brand_name, brand_slug ),
      collections ( collection_name )
    `, { count: 'exact' })

  const DB_SORT_COLUMNS = ['updated_at', 'created_at', 'pattern_name', 'show_on_website'] as const
  type DbSortCol = typeof DB_SORT_COLUMNS[number]
  const dbSortBy: DbSortCol = (DB_SORT_COLUMNS as readonly string[]).includes(sortBy ?? '')
    ? (sortBy as DbSortCol)
    : 'updated_at'

  query = query.order(dbSortBy, { ascending: sortOrder === 'asc' })
  query = query.range((page - 1) * limit, page * limit - 1)

  if (search) query = query.ilike('pattern_name', `%${search}%`)
  if (brandId) query = query.eq('brand_id', brandId)
  if (patternId) query = query.eq('pattern_id', patternId)
  if (status === 'published') query = query.eq('show_on_website', true)
  if (status === 'draft') query = query.eq('show_on_website', false)

  const { data: patternRows, error, count } = await query
  if (error) throw error

  const rows = patternRows ?? []

  // Step 2: Fetch SKU aggregates only for the N patterns on this page
  type SkuAgg = { count: number; activeCount: number; totalStock: number; loadIndexes: string[]; firstSku: string | null }
  const skuMap: Record<string, SkuAgg> = {}

  if (rows.length > 0) {
    const patternIds = rows.map(r => r.pattern_id)
    const { data: skuRows, error: skuErr } = await supabase
      .from('skus')
      .select('pattern_id, sku, status, total_available_stock, load_index')
      .in('pattern_id', patternIds)
      .order('created_at', { ascending: true })
    if (skuErr) { console.error('[listProducts] skuErr:', skuErr); throw skuErr }

    for (const sku of skuRows ?? []) {
      const pid = sku.pattern_id as string
      if (!skuMap[pid]) skuMap[pid] = { count: 0, activeCount: 0, totalStock: 0, loadIndexes: [], firstSku: null }
      if (!skuMap[pid].firstSku) skuMap[pid].firstSku = sku.sku as string
      skuMap[pid].count++
      if (sku.status === 'active') skuMap[pid].activeCount++
      skuMap[pid].totalStock += (sku.total_available_stock as number) ?? 0
      if (sku.load_index) skuMap[pid].loadIndexes.push(sku.load_index as string)
    }
    for (const pid of Object.keys(skuMap)) {
      skuMap[pid].loadIndexes = [...new Set(skuMap[pid].loadIndexes)].sort()
    }
  }

  // Apply stock filter against aggregated data
  const filteredRows = stock
    ? rows.filter(row => {
      const totalStock = skuMap[row.pattern_id]?.totalStock ?? 0
      if (stock === 'in_stock') return totalStock > 0
      if (stock === 'no_stock') return totalStock === 0
      return true
    })
    : rows

  const data = filteredRows.map(row => {
    const agg = skuMap[row.pattern_id] ?? { count: 0, activeCount: 0, totalStock: 0, loadIndexes: [], firstSku: null }
    return {
      id: row.pattern_id,
      name: row.pattern_name,
      slug: row.pattern_slug,
      image: (row.main_image as string | null) ?? null,
      brand: (row.brands as unknown as { brand_name: string; brand_slug: string } | null),
      collection: (row.collections as unknown as { collection_name: string } | null),
      variantCount: agg.count,
      activeVariantCount: agg.activeCount,
      totalStock: agg.totalStock,
      loadIndexes: agg.loadIndexes,
      firstSku: agg.firstSku,
      isActive: row.is_active,
      showOnWebsite: row.show_on_website,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    }
  })
  return { data, total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) }
}

// ============================================================
// SEARCH SKUs (for dropdowns / autocompletes)
// ============================================================
export async function searchSkus(query: string, limit = 20) {
  if (!query.trim()) {
    const { data } = await supabase
      .from('skus')
      .select('product_id, sku, tyre_size_display, status, patterns ( pattern_name, brands ( brand_name ) )')
      .limit(limit)
    return data ?? []
  }

  // Normalize the user's query as a tyre size code so typing "21565R1698H"
  // matches normalized_size_code "21565R16" (which strips load/speed rating)
  const normalizedQuery = normalizeTyreSize(query)
  // Also try just stripping all non-alphanumeric for a raw prefix match
  const alphaQuery = query.replace(/[^a-z0-9]/gi, '')

  console.log('[searchSkus] query:', query, '| normalized:', normalizedQuery, '| alpha:', alphaQuery)

  // Run three searches in parallel:
  // 1) direct SKU / tyre_size_display text match
  // 2) normalized_size_code match (handles tyre size typed without slashes/spaces)
  // 3) pattern name match → fetch those SKUs
  const queries: Promise<{ data: any[] | null; error: any }>[] = [
    supabase
      .from('skus')
      .select('product_id, sku, tyre_size_display, status, patterns ( pattern_name, brands ( brand_name ) )')
      .or(`sku.ilike.%${query}%,tyre_size_display.ilike.%${query}%`)
      .limit(limit) as any,
    supabase
      .from('patterns')
      .select('pattern_id')
      .ilike('pattern_name', `%${query}%`)
      .limit(20) as any,
  ]

  // Only add normalized_size_code search if the normalized result looks like a real size code (digits only)
  const normalizedForSearch = normalizedQuery.length >= 4 ? normalizedQuery : alphaQuery
  if (normalizedForSearch && normalizedForSearch !== query) {
    queries.push(
      supabase
        .from('skus')
        .select('product_id, sku, tyre_size_display, status, patterns ( pattern_name, brands ( brand_name ) )')
        .ilike('normalized_size_code', `%${normalizedForSearch}%`)
        .limit(limit) as any
    )
  }

  const [skuTextRes, patternRes, normSizeRes] = await Promise.all(queries)

  const patternIds = ((patternRes?.data ?? []) as { pattern_id: string }[]).map(p => p.pattern_id)

  let patternSkus: any[] = []
  if (patternIds.length > 0) {
    const { data } = await supabase
      .from('skus')
      .select('product_id, sku, tyre_size_display, status, patterns ( pattern_name, brands ( brand_name ) )')
      .in('pattern_id', patternIds)
      .limit(limit)
    patternSkus = data ?? []
  }

  // Merge + deduplicate by product_id
  const seen = new Set<string>()
  const merged = [
    ...(skuTextRes?.data ?? []),
    ...(normSizeRes?.data ?? []),
    ...patternSkus,
  ].filter((r: any) => {
    if (seen.has(r.product_id)) return false
    seen.add(r.product_id)
    return true
  })

  console.log('[searchSkus] merged results:', merged.length)
  return merged.slice(0, limit)
}

// ============================================================
// GET SINGLE PRODUCT (pattern + all SKUs + prices + stock)
// ============================================================
export async function getProduct(patternId: string) {
  const { data: pattern, error } = await supabase
    .from('patterns')
    .select(`
      *,
      brands!inner ( brand_id, brand_name, brand_slug, brand_logo ),
      collections ( collection_id, collection_name ),
      pattern_categories ( categories ( category_id, category_name, category_type ) )
    `)
    .eq('pattern_id', patternId)
    .single()

  if (error) throw error

  // Fetch SKUs with prices and stock
  const { data: skus } = await supabase
    .from('skus')
    .select(`
      *,
      product_prices ( price_id, price_type, price_inc_gst, price_ex_gst, is_active, customer_group_id, warehouse_id, start_date, end_date, customer_groups ( group_name ), warehouses ( warehouse_name ) ),
      product_stock ( stock_id, warehouse_id, available_stock, reserved_stock, incoming_stock, in_transit_stock, damaged_stock, minimum_stock_level, last_purchase_price, last_stock_update, warehouses ( warehouse_name ) )
    `)
    .eq('pattern_id', patternId)
    .order('rim_size', { ascending: true })

  return { pattern, skus: skus ?? [] }
}

// ============================================================
// CREATE PRODUCT
// Creates pattern + N SKUs + prices + initial stock rows
// ============================================================
export async function createProduct(payload: CreateProductPayload) {
  // 1. Create pattern
  const { data: pattern, error: patternErr } = await supabase
    .from('patterns')
    .insert({
      brand_id: payload.brandId,
      pattern_name: payload.patternName,
      pattern_slug: payload.patternSlug,
      pattern_short_description: payload.shortDescription,
      gallery_images: payload.galleryImages ?? [],
      main_image: payload.galleryImages?.[0] ?? null,
      tyre_overview: payload.tyreOverview,
      features: payload.features,
      warranty_information: payload.warrantyInformation,
      tyre_spec_sheet: payload.tyreSpecSheet,
      faq_list: payload.faqList ?? [],
      discountable: payload.discountable,
      application_type: payload.applicationType,
      performance_category: payload.performanceCategory ?? null,
      season_type: payload.seasonType ?? null,
      collection_id: payload.collectionId ?? null,
      tags: payload.tags ?? [],
      position_category: payload.positionCategory ?? null,
      shoulder_type: payload.shoulderType ?? null,
      terrain_type: payload.terrainType ?? null,
      warranty_km: payload.warrantyKm ?? null,
      seo_title: payload.seoTitle ?? null,
      seo_description: payload.seoDescription ?? null,
      tread_image: payload.treadImage ?? null,
      default_country_of_origin: payload.defaultCountryOfOrigin ?? null,
      is_active: payload.isActive ?? true,
      show_on_website: payload.showOnWebsite ?? false,
    })
    .select('pattern_id')
    .single()

  if (patternErr) throw patternErr

  const patternId = pattern.pattern_id

  // 2. Assign categories (pattern_categories junction)
  if (payload.categoryIds && payload.categoryIds.length > 0) {
    await supabase.from('pattern_categories').insert(
      payload.categoryIds.map(cid => ({ pattern_id: patternId, category_id: cid }))
    )
  }

  // 3. Batch-insert all SKUs in one round-trip, then batch prices and stock.
  // Was: N×3 sequential queries. Now: 3 sequential queries regardless of variant count.
  const gstRate = 0.1

  const { data: createdSkuRows, error: skuErr } = await supabase
    .from('skus')
    .insert(
      payload.variants.map((v, i) => {
        const p = payload.pricing[i] ?? {}
        return {
          brand_id: payload.brandId,
          pattern_id: patternId,
          sku: v.sku,
          tyre_size_display: v.tyreSizeDisplay,
          normalized_size_code: normalizeTyreSize(v.tyreSizeDisplay),
          width: v.width ?? null,
          profile: v.profile ?? null,
          rim_size: v.rimSize,
          special_size: v.specialSize || null,
          barcode_ean: v.barcodeEan || null,
          lt_sizing: v.ltSizing ?? false,
          construction_type: v.constructionType || null,
          load_index: v.loadIndex || null,
          load_speed_rating: v.loadSpeedRating || null,
          speed_rating: v.speedRating || null,
          fuel_rating: v.fuelRating || null,
          wet_grip: v.wetGrip || null,
          noise_db: v.noiseDb || null,
          noise_class: v.noiseClass || null,
          runflat: v.runflat,
          xl_reinforced: v.xlReinforced ?? false,
          ply_rating: v.plyRating || null,
          load_range: v.loadRange || null,
          sidewall: v.sidewall || null,
          tube_type: v.tubeType || null,
          country_of_origin: v.countryOfOrigin,
          manufacturer_name: v.manufacturerName || null,
          factory_name: v.factoryName || null,
          factory_country: v.factoryCountry || null,
          section_width: v.sectionWidth || null,
          tread_depth: v.treadDepth || null,
          tyre_weight: v.tyreWeight || null,
          overall_diameter: v.overallDiameter || null,
          max_load: v.maxLoad || null,
          max_pressure: v.maxPressure || null,
          e_mark: v.eMark || null,
          dot_code: v.dotCode || null,
          utqg: v.utqg || null,
          variant_images: v.variantImages || [],
          status: v.status || 'active',
          replacement_product_id: v.replacementProductId || null,
          compare_at_price: p.compareAtPrice ?? null,
          cost_price: p.costPrice ?? null,
          low_stock_alert: p.lowStockAlert ?? 10,
          total_available_stock: 0,
        }
      })
    )
    .select('product_id')

  if (skuErr) {
    if (skuErr.code === '23505' && skuErr.message.includes('skus_sku_key')) {
      throw new Error('One or more of the provided SKUs are already in use. SKUs must be unique.')
    }
    throw skuErr
  }

  const createdSkus = (createdSkuRows ?? []).map(r => r.product_id)

  // 4a. Batch-insert all retail price rows
  const priceRows = createdSkuRows!
    .map((sku, i) => {
      const p = payload.pricing[i] ?? {}
      if (!p.priceIncGst) return null
      return {
        product_id: sku.product_id,
        price_type: 'retail' as const,
        price_inc_gst: p.priceIncGst,
        price_ex_gst: parseFloat((p.priceIncGst / (1 + gstRate)).toFixed(2)),
        is_active: true,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (priceRows.length > 0) {
    await supabase.from('product_prices').insert(priceRows)
  }

  // 4b. Batch-insert all initial stock rows
  const stockRows = createdSkuRows!
    .map((sku, i) => {
      const p = payload.pricing[i] ?? {}
      if (!p.warehouseId || (p.inventory ?? 0) <= 0) return null
      return {
        product_id: sku.product_id,
        warehouse_id: p.warehouseId,
        available_stock: p.inventory ?? 0,
        reserved_stock: 0,
        incoming_stock: 0,
        in_transit_stock: 0,
        damaged_stock: 0,
        minimum_stock_level: p.lowStockAlert ?? 10,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (stockRows.length > 0) {
    await supabase.from('product_stock').insert(stockRows)
  }

  return { patternId, skuIds: createdSkus }
}

// ============================================================
// UPDATE PRODUCT (pattern fields only)
// ============================================================
export async function updateProduct(patternId: string, payload: Partial<CreateProductPayload>) {
  console.log('[updateProduct service] patternId:', patternId)
  console.log('[updateProduct service] payload keys:', Object.keys(payload))

  const updates: Record<string, unknown> = {}

  if (payload.brandId !== undefined) updates.brand_id = payload.brandId
  if (payload.patternName !== undefined) updates.pattern_name = payload.patternName
  if (payload.patternSlug !== undefined) updates.pattern_slug = payload.patternSlug
  if (payload.shortDescription !== undefined) updates.pattern_short_description = payload.shortDescription
  if (payload.galleryImages !== undefined) {
    updates.gallery_images = payload.galleryImages
    updates.main_image = payload.galleryImages[0] ?? null
  }
  if (payload.tyreOverview !== undefined) updates.tyre_overview = payload.tyreOverview
  if (payload.features !== undefined) updates.features = payload.features
  if (payload.warrantyInformation !== undefined) updates.warranty_information = payload.warrantyInformation
  if (payload.tyreSpecSheet !== undefined) updates.tyre_spec_sheet = payload.tyreSpecSheet
  if (payload.faqList !== undefined) updates.faq_list = payload.faqList
  if (payload.discountable !== undefined) updates.discountable = payload.discountable
  if (payload.applicationType !== undefined) updates.application_type = payload.applicationType
  if (payload.performanceCategory !== undefined) updates.performance_category = payload.performanceCategory
  if (payload.seasonType !== undefined) updates.season_type = payload.seasonType
  if (payload.collectionId !== undefined) updates.collection_id = payload.collectionId
  if (payload.tags !== undefined) updates.tags = payload.tags
  if (payload.positionCategory !== undefined) updates.position_category = payload.positionCategory
  if (payload.shoulderType !== undefined) updates.shoulder_type = payload.shoulderType
  if (payload.terrainType !== undefined) updates.terrain_type = payload.terrainType
  if (payload.warrantyKm !== undefined) updates.warranty_km = payload.warrantyKm
  if (payload.isActive !== undefined) updates.is_active = payload.isActive
  if (payload.showOnWebsite !== undefined) updates.show_on_website = payload.showOnWebsite
  if (payload.seoTitle !== undefined) updates.seo_title = payload.seoTitle
  if (payload.seoDescription !== undefined) updates.seo_description = payload.seoDescription
  if (payload.treadImage !== undefined) updates.tread_image = payload.treadImage
  if (payload.defaultCountryOfOrigin !== undefined) updates.default_country_of_origin = payload.defaultCountryOfOrigin

  console.log('[updateProduct service] supabase updates object:', updates)
  const { error, data } = await supabase
    .from('patterns')
    .update(updates)
    .eq('pattern_id', patternId)
    .select('pattern_id, pattern_name, brand_id')
  console.log('[updateProduct service] supabase result — error:', error, 'data:', data)
  console.log('[updateProduct service] brand_id in updates:', updates.brand_id, '| returned brand_id:', data?.[0]?.brand_id)
  if (error) throw error

  // Update categories if provided
  if (payload.categoryIds !== undefined) {
    console.log('[updateProduct service] updating categories:', payload.categoryIds)
    await supabase.from('pattern_categories').delete().eq('pattern_id', patternId)
    if (payload.categoryIds.length > 0) {
      const { error: catErr } = await supabase.from('pattern_categories').insert(
        payload.categoryIds.map(cid => ({ pattern_id: patternId, category_id: cid }))
      )
      console.log('[updateProduct service] categories insert error:', catErr)
    }
  }

}

// ============================================================
// PUBLISH / UNPUBLISH
// ============================================================
export async function publishProduct(patternId: string, publish?: boolean, active?: boolean) {
  if (publish !== undefined) {
    await supabase.from('patterns').update({ show_on_website: publish }).eq('pattern_id', patternId)
    await supabase.from('skus')
      .update({ status: publish ? 'active' : 'inactive' })
      .eq('pattern_id', patternId)
  }
  if (active !== undefined) {
    await supabase.from('patterns').update({ is_active: active }).eq('pattern_id', patternId)
  }
}

// ============================================================
// VARIANT — add single SKU to existing pattern
// ============================================================
export async function addVariant(patternId: string, variant: VariantPayload, pricing: PricingPayload) {
  const { data: pattern } = await supabase
    .from('patterns').select('brand_id').eq('pattern_id', patternId).single()
  if (!pattern) throw new Error('Pattern not found')

  const normalizedSize = normalizeTyreSize(variant.tyreSizeDisplay)

  const { data: sku, error } = await supabase.from('skus').insert({
    brand_id: pattern.brand_id,
    pattern_id: patternId,
    sku: variant.sku,
    tyre_size_display: variant.tyreSizeDisplay,
    normalized_size_code: normalizedSize,
    width: variant.width ?? null,
    profile: variant.profile ?? null,
    rim_size: variant.rimSize,
    special_size: variant.specialSize || null,
    barcode_ean: variant.barcodeEan || null,
    lt_sizing: variant.ltSizing ?? false,
    construction_type: variant.constructionType || null,
    load_index: variant.loadIndex || null,
    load_speed_rating: variant.loadSpeedRating || null,
    speed_rating: variant.speedRating || null,
    fuel_rating: variant.fuelRating || null,
    wet_grip: variant.wetGrip || null,
    noise_db: variant.noiseDb || null,
    noise_class: variant.noiseClass || null,
    runflat: variant.runflat,
    xl_reinforced: variant.xlReinforced ?? false,
    ply_rating: variant.plyRating || null,
    load_range: variant.loadRange || null,
    sidewall: variant.sidewall || null,
    tube_type: variant.tubeType || null,
    country_of_origin: variant.countryOfOrigin,
    manufacturer_name: variant.manufacturerName || null,
    factory_name: variant.factoryName || null,
    factory_country: variant.factoryCountry || null,
    section_width: variant.sectionWidth || null,
    tread_depth: variant.treadDepth || null,
    tyre_weight: variant.tyreWeight || null,
    overall_diameter: variant.overallDiameter || null,
    max_load: variant.maxLoad || null,
    max_pressure: variant.maxPressure || null,
    e_mark: variant.eMark || null,
    dot_code: variant.dotCode || null,
    utqg: variant.utqg || null,
    variant_images: variant.variantImages || [],
    status: variant.status || 'active',
    replacement_product_id: variant.replacementProductId || null,
    compare_at_price: pricing.compareAtPrice ?? null,
    cost_price: pricing.costPrice ?? null,
    low_stock_alert: pricing.lowStockAlert ?? 10,
    total_available_stock: 0,
  }).select('product_id').single()

  if (error) {
    if (error.code === '23505' && error.message.includes('skus_sku_key')) {
      throw new Error(`The SKU "${variant.sku}" is already in use by another product.`)
    }
    throw error
  }

  if (pricing.priceIncGst) {
    await supabase.from('product_prices').insert({
      product_id: sku.product_id,
      price_type: 'retail',
      price_inc_gst: pricing.priceIncGst,
      price_ex_gst: parseFloat((pricing.priceIncGst / 1.1).toFixed(2)),
      is_active: true,
    })
  }

  if (pricing.warehouseId && (pricing.inventory ?? 0) > 0) {
    await supabase.from('product_stock').insert({
      product_id: sku.product_id,
      warehouse_id: pricing.warehouseId,
      available_stock: pricing.inventory ?? 0,
      reserved_stock: 0,
      incoming_stock: 0,
      in_transit_stock: 0,
      damaged_stock: 0,
      minimum_stock_level: pricing.lowStockAlert ?? 10,
    })
    await supabase.from('skus').update({ total_available_stock: pricing.inventory ?? 0 }).eq('product_id', sku.product_id)
  }

  return sku.product_id
}

// ============================================================
// VARIANT — patch (edit) an existing SKU
// ============================================================
export async function patchVariant(variantId: string, variant: Partial<VariantPayload>) {
  const updates: Record<string, unknown> = {}
  if (variant.sku !== undefined) updates.sku = variant.sku
  if (variant.tyreSizeDisplay !== undefined) { updates.tyre_size_display = variant.tyreSizeDisplay; updates.normalized_size_code = normalizeTyreSize(variant.tyreSizeDisplay) }
  if (variant.width !== undefined) updates.width = variant.width ?? null
  if (variant.profile !== undefined) updates.profile = variant.profile ?? null
  if (variant.rimSize !== undefined) updates.rim_size = variant.rimSize
  if (variant.specialSize !== undefined) updates.special_size = variant.specialSize || null
  if (variant.barcodeEan !== undefined) updates.barcode_ean = variant.barcodeEan || null
  if (variant.ltSizing !== undefined) updates.lt_sizing = variant.ltSizing
  if (variant.constructionType !== undefined) updates.construction_type = variant.constructionType || null
  if (variant.loadIndex !== undefined) updates.load_index = variant.loadIndex || null
  if (variant.loadSpeedRating !== undefined) updates.load_speed_rating = variant.loadSpeedRating || null
  if (variant.speedRating !== undefined) updates.speed_rating = variant.speedRating || null
  if (variant.fuelRating !== undefined) updates.fuel_rating = variant.fuelRating || null
  if (variant.wetGrip !== undefined) updates.wet_grip = variant.wetGrip || null
  if (variant.noiseDb !== undefined) updates.noise_db = variant.noiseDb || null
  if (variant.noiseClass !== undefined) updates.noise_class = variant.noiseClass || null
  if (variant.runflat !== undefined) updates.runflat = variant.runflat
  if (variant.xlReinforced !== undefined) updates.xl_reinforced = variant.xlReinforced
  if (variant.plyRating !== undefined) updates.ply_rating = variant.plyRating || null
  if (variant.loadRange !== undefined) updates.load_range = variant.loadRange || null
  if (variant.sidewall !== undefined) updates.sidewall = variant.sidewall || null
  if (variant.tubeType !== undefined) updates.tube_type = variant.tubeType || null
  if (variant.countryOfOrigin !== undefined) updates.country_of_origin = variant.countryOfOrigin
  if (variant.manufacturerName !== undefined) updates.manufacturer_name = variant.manufacturerName || null
  if (variant.factoryName !== undefined) updates.factory_name = variant.factoryName || null
  if (variant.factoryCountry !== undefined) updates.factory_country = variant.factoryCountry || null
  if (variant.sectionWidth !== undefined) updates.section_width = variant.sectionWidth || null
  if (variant.treadDepth !== undefined) updates.tread_depth = variant.treadDepth || null
  if (variant.tyreWeight !== undefined) updates.tyre_weight = variant.tyreWeight || null
  if (variant.overallDiameter !== undefined) updates.overall_diameter = variant.overallDiameter || null
  if (variant.maxLoad !== undefined) updates.max_load = variant.maxLoad || null
  if (variant.maxPressure !== undefined) updates.max_pressure = variant.maxPressure || null
  if (variant.eMark !== undefined) updates.e_mark = variant.eMark || null
  if (variant.dotCode !== undefined) updates.dot_code = variant.dotCode || null
  if (variant.utqg !== undefined) updates.utqg = variant.utqg || null
  if (variant.status !== undefined) updates.status = variant.status
  if ((variant as { compareAtPrice?: number | null }).compareAtPrice !== undefined) updates.compare_at_price = (variant as { compareAtPrice?: number | null }).compareAtPrice ?? null
  if ((variant as { costPrice?: number | null }).costPrice !== undefined) updates.cost_price = (variant as { costPrice?: number | null }).costPrice ?? null
  if ((variant as { lowStockAlert?: number | null }).lowStockAlert !== undefined) updates.low_stock_alert = (variant as { lowStockAlert?: number | null }).lowStockAlert ?? null
  if ((variant as { replacementProductId?: string | null }).replacementProductId !== undefined) updates.replacement_product_id = (variant as { replacementProductId?: string | null }).replacementProductId ?? null
  if ((variant as { helperCode?: string | null }).helperCode !== undefined) updates.helper_code = (variant as { helperCode?: string | null }).helperCode ?? null
  if ((variant as { supplierCode?: string | null }).supplierCode !== undefined) updates.supplier_code = (variant as { supplierCode?: string | null }).supplierCode ?? null

  if (Object.keys(updates).length === 0) return
  const { error } = await supabase.from('skus').update(updates).eq('product_id', variantId)
  if (error) {
    if (error.code === '23505' && error.message.includes('skus_sku_key')) {
      throw new Error(`The SKU "${updates.sku ?? variant.sku}" is already in use.`)
    }
    throw error
  }
}

// ============================================================
// VARIANT STOCK — update stock levels per warehouse
// ============================================================
export async function updateVariantStock(
  productId: string,
  warehouseId: string,
  availableStock: number,
  lowStockAlert?: number
) {
  const { error } = await supabase.from('product_stock').upsert(
    {
      product_id: productId,
      warehouse_id: warehouseId,
      available_stock: availableStock,
      minimum_stock_level: lowStockAlert ?? 10,
    },
    { onConflict: 'product_id,warehouse_id' }
  )
  if (error) throw error

  await redis?.del(`stock:${productId}`)
}

// ============================================================
// DELETE PRODUCT (pattern + all child rows)
// ============================================================
export async function deleteProduct(patternId: string) {
  // Get all SKU ids first
  const { data: skus } = await supabase
    .from('skus').select('product_id').eq('pattern_id', patternId)
  const skuIds = (skus ?? []).map(s => s.product_id)

  if (skuIds.length > 0) {
    await supabase.from('product_prices').delete().in('product_id', skuIds)
    await supabase.from('product_stock').delete().in('product_id', skuIds)
    await supabase.from('skus').delete().in('product_id', skuIds)
  }

  await supabase.from('pattern_categories').delete().eq('pattern_id', patternId)

  const { error } = await supabase.from('patterns').delete().eq('pattern_id', patternId)
  if (error) throw error

  // Invalidate cache
  await redis?.del('admin:brands')
}

// ============================================================
// DELETE VARIANT (sku + prices + stock)
// ============================================================
export async function deleteVariant(productId: string) {
  await supabase.from('product_prices').delete().eq('product_id', productId)
  await supabase.from('product_stock').delete().eq('product_id', productId)

  const { error } = await supabase.from('skus').delete().eq('product_id', productId)
  if (error) throw error

  await redis?.del(`stock:${productId}`)
}

// ============================================================
// UPDATE VARIANT PRICES — upsert by (product_id, customer_group_id)
// prices is a map of { 'Retail': 199.99, ... }  (group_name → price_inc_gst)
// ============================================================
export async function updateVariantPrices(
  productId: string,
  prices: Record<string, number>
) {
  // Fetch existing price rows so we can match by price_id
  const { data: existing } = await supabase
    .from('product_prices')
    .select('price_id, customer_group_id, price_type')
    .eq('product_id', productId)

  const gstRate = 0.1

  const toUpdate: { price_id: string; price_inc_gst: number; price_ex_gst: number }[] = []
  const toInsert: { product_id: string; price_type: string; price_inc_gst: number; price_ex_gst: number; is_active: boolean }[] = []

  for (const [groupName, priceIncGst] of Object.entries(prices)) {
    const row = (existing ?? []).find(p =>
      groupName === 'Retail' ? p.customer_group_id === null : false
    ) ?? (existing ?? [])[0]

    const priceExGst = parseFloat((priceIncGst / (1 + gstRate)).toFixed(2))

    if (row?.price_id) {
      toUpdate.push({ price_id: row.price_id, price_inc_gst: priceIncGst, price_ex_gst: priceExGst })
    } else {
      toInsert.push({ product_id: productId, price_type: 'retail', price_inc_gst: priceIncGst, price_ex_gst: priceExGst, is_active: true })
    }
  }

  // Batch all DB writes — N sequential round-trips → at most 2 parallel
  const ops: Promise<{ error: unknown }>[] = []
  if (toUpdate.length > 0) {
    ops.push(supabase.from('product_prices').upsert(toUpdate, { onConflict: 'price_id' }) as unknown as Promise<{ error: unknown }>)
  }
  if (toInsert.length > 0) {
    ops.push(supabase.from('product_prices').insert(toInsert) as unknown as Promise<{ error: unknown }>)
  }
  if (ops.length > 0) {
    const results = await Promise.all(ops)
    for (const { error } of results) {
      if (error) throw error
    }
  }

}

// ============================================================
// PRICE CRUD — add / update / delete individual price rows
// ============================================================

export type PricePayload = {
  price_type: string
  price_inc_gst: number
  customer_group_id?: string | null
  warehouse_id?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean
}

export async function addVariantPrice(productId: string, payload: PricePayload) {
  const price_ex_gst = parseFloat((payload.price_inc_gst / 1.1).toFixed(2))
  const { data, error } = await supabase.from('product_prices').insert({
    product_id: productId,
    price_type: payload.price_type,
    price_inc_gst: payload.price_inc_gst,
    price_ex_gst,
    customer_group_id: payload.customer_group_id ?? null,
    warehouse_id: payload.warehouse_id ?? null,
    start_date: payload.start_date ?? null,
    end_date: payload.end_date ?? null,
    is_active: payload.is_active ?? true,
  }).select('price_id').single()
  if (error) throw error
  return data
}

export async function updatePrice(priceId: string, payload: Partial<PricePayload>) {
  const updates: Record<string, unknown> = { ...payload }
  if (payload.price_inc_gst !== undefined) {
    updates.price_ex_gst = parseFloat((payload.price_inc_gst / 1.1).toFixed(2))
  }
  const { error } = await supabase.from('product_prices').update(updates).eq('price_id', priceId)
  if (error) throw error
}

export async function deletePrice(priceId: string) {
  const { error } = await supabase.from('product_prices').delete().eq('price_id', priceId)
  if (error) throw error
}

// ============================================================
// PRODUCT STOCK — per-warehouse + supplier breakdown
// ============================================================
export async function getProductStock(productId: string) {
  // Fetch all active own-warehouses + existing product_stock rows in parallel
  const [
    { data: allWarehouses, error: wAllErr },
    { data: stockRows, error: wErr },
    { data: supplierStockRows },
    { data: approvedMaps },
  ] = await Promise.all([
    supabase
      .from('warehouses')
      .select('warehouse_id, warehouse_name, is_own_warehouse, is_supplier_warehouse')
      .eq('is_active', true)
      .eq('is_own_warehouse', true),
    supabase
      .from('product_stock')
      .select(`
        stock_id,
        warehouse_id,
        available_stock,
        reserved_stock,
        incoming_stock,
        in_transit_stock,
        damaged_stock,
        minimum_stock_level,
        last_purchase_price,
        last_stock_update
      `)
      .eq('product_id', productId),
    supabase
      .from('supplier_product_stock')
      .select('supplier_id, available_stock, suppliers ( supplier_name )')
      .eq('product_id', productId),
    supabase
      .from('supplier_product_map')
      .select('supplier_id, supplier_stock, suppliers ( supplier_name )')
      .eq('product_id', productId)
      .eq('is_verified', true),
  ])

  if (wAllErr) throw wAllErr
  if (wErr) throw wErr

  // Build a lookup of existing stock rows by warehouse_id
  const stockByWarehouse = new Map<string, typeof stockRows extends (infer T)[] | null ? T : never>()
  for (const r of (stockRows ?? [])) stockByWarehouse.set(r.warehouse_id, r)

  // Left-join: all own warehouses, with stock data if available (zeros if not)
  const warehouses = (allWarehouses ?? []).map(w => {
    const s = stockByWarehouse.get(w.warehouse_id)
    return {
      stock_id: s?.stock_id ?? null,
      warehouse_id: w.warehouse_id,
      warehouse_name: w.warehouse_name,
      is_own_warehouse: w.is_own_warehouse,
      available: s?.available_stock ?? 0,
      reserved: s?.reserved_stock ?? 0,
      incoming: s?.incoming_stock ?? 0,
      in_transit: s?.in_transit_stock ?? 0,
      damaged: s?.damaged_stock ?? 0,
      minimum_stock_level: s?.minimum_stock_level ?? 0,
      last_purchase_price: (s as Record<string, unknown> | undefined)?.last_purchase_price as number | null ?? null,
      last_stock_update: s?.last_stock_update ?? null,
    }
  })

  // Merge: use synced stock if available, else fall back to catalogue stock on approved map
  const supplierMap = new Map<string, { supplier_name: string; stock: number }>()
  for (const r of (supplierStockRows ?? [])) {
    const sup = r.suppliers as unknown as { supplier_name: string } | null
    const name = sup?.supplier_name ?? 'Unknown'
    supplierMap.set(r.supplier_id, { supplier_name: name, stock: r.available_stock ?? 0 })
  }
  for (const m of (approvedMaps ?? [])) {
    if (!supplierMap.has(m.supplier_id) && (m.supplier_stock ?? 0) > 0) {
      const sup = m.suppliers as unknown as { supplier_name: string } | null
      supplierMap.set(m.supplier_id, { supplier_name: sup?.supplier_name ?? 'Unknown', stock: m.supplier_stock ?? 0 })
    }
  }

  const supplierContributions = [...supplierMap.entries()].map(([supplier_id, v]) => ({
    supplier_id, supplier_name: v.supplier_name, stock: v.stock,
  }))

  const totalSupplierStock = supplierContributions.reduce((s, r) => s + r.stock, 0)

  const suppliers = supplierContributions.map(r => ({
    ...r,
    percentage: totalSupplierStock > 0 ? Math.round((r.stock / totalSupplierStock) * 100) : 0,
  }))

  return { warehouses, suppliers, total_supplier_stock: totalSupplierStock }
}

export async function updateProductStock(
  productId: string,
  allocations: {
    warehouse_id: string
    available: number
    reserved?: number
    incoming?: number
    in_transit?: number
    damaged?: number
    minimum_stock_level?: number
  }[]
) {
  const now = new Date().toISOString()
  const patches = allocations.map(alloc => {
    const patch: Record<string, unknown> = {
      product_id: productId,
      warehouse_id: alloc.warehouse_id,
      available_stock: alloc.available,
      last_stock_update: now,
    }
    if (alloc.reserved !== undefined) patch.reserved_stock = alloc.reserved
    if (alloc.incoming !== undefined) patch.incoming_stock = alloc.incoming
    if (alloc.in_transit !== undefined) patch.in_transit_stock = alloc.in_transit
    if (alloc.damaged !== undefined) patch.damaged_stock = alloc.damaged
    if (alloc.minimum_stock_level !== undefined) patch.minimum_stock_level = alloc.minimum_stock_level
    return patch
  })

  // Single batch upsert — was N sequential round-trips
  const { error } = await supabase
    .from('product_stock')
    .upsert(patches, { onConflict: 'product_id,warehouse_id' })
  if (error) throw error

  // Recompute total_available_stock on the SKU
  const { data: stockRows } = await supabase
    .from('product_stock')
    .select('available_stock')
    .eq('product_id', productId)

  const total = (stockRows ?? []).reduce((s, r) => s + (r.available_stock ?? 0), 0)
  await supabase.from('skus').update({ total_available_stock: total }).eq('product_id', productId)

  await redis?.del(`stock:${productId}`)
}

// ============================================================
// PRODUCT-CENTRIC SUPPLIER MAPPINGS
// Manage supplier_product_map rows from the product/variant side
// ============================================================

export async function getProductSupplierMappings(productId: string) {
  // Get all supplier_product_map rows for this product
  const { data: maps, error: mErr } = await supabase
    .from('supplier_product_map')
    .select(`
      id,
      supplier_id,
      supplier_sku,
      supplier_brand_name,
      supplier_pattern_name,
      supplier_size_raw,
      supplier_price,
      supplier_stock,
      lead_time_days,
      match_confidence,
      is_verified,
      last_updated,
      created_at,
      suppliers ( supplier_name, connection_type )
    `)
    .eq('product_id', productId)
    .order('last_updated', { ascending: false, nullsFirst: false })

  if (mErr) throw mErr

  // Get synced stock for this product
  const { data: stocks } = await supabase
    .from('supplier_product_stock')
    .select('supplier_id, available_stock, supplier_price, stock_last_updated, lead_time_days')
    .eq('product_id', productId)

  const stockMap = new Map((stocks ?? []).map(s => [s.supplier_id, s]))

  return (maps ?? []).map(m => {
    const sup = m.suppliers as unknown as { supplier_name: string; connection_type: string } | null
    const synced = stockMap.get(m.supplier_id) ?? null
    return {
      id: m.id,
      supplier_id: m.supplier_id,
      supplier_name: sup?.supplier_name ?? null,
      connection_type: sup?.connection_type ?? 'manual',
      supplier_sku: m.supplier_sku,
      supplier_price: m.supplier_price,
      supplier_stock: m.supplier_stock,
      lead_time_days: m.lead_time_days,
      match_confidence: m.match_confidence,
      is_verified: m.is_verified,
      last_updated: m.last_updated,
      synced_price: synced?.supplier_price ?? null,
      synced_qty: synced?.available_stock ?? null,
      synced_at: synced?.stock_last_updated ?? null,
    }
  })
}

export async function addProductSupplierMapping(productId: string, payload: {
  supplier_id: string
  supplier_sku: string
  supplier_price?: number | null
  supplier_stock?: number | null
  lead_time_days?: number | null
}) {
  const { data, error } = await supabase
    .from('supplier_product_map')
    .upsert(
      {
        supplier_id: payload.supplier_id,
        product_id: productId,
        supplier_sku: payload.supplier_sku,
        supplier_price: payload.supplier_price ?? null,
        supplier_stock: payload.supplier_stock ?? 0,
        lead_time_days: payload.lead_time_days ?? null,
        match_confidence: 100,
        is_verified: true,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'supplier_id,product_id' }
    )
    .select('id, supplier_id')
    .single()

  if (error) throw error

  // Enqueue stock sync immediately (catalogueSyncQueue imported via lazy require to avoid circular dep)
  const { catalogueSyncQueue } = await import('../queues')
  if (catalogueSyncQueue && data?.supplier_id) {
    await catalogueSyncQueue.add('sync_supplier_stock', {
      type: 'sync_supplier_stock',
      supplier_id: data.supplier_id,
      product_id: productId,
    }, {
      jobId: `sync_stock:${data.supplier_id}:${productId}`,
    })
  }

  return data
}

export async function removeProductSupplierMapping(mapId: string) {
  // Fetch supplier_id + product_id before deleting (needed to remove stock row)
  const { data: row } = await supabase
    .from('supplier_product_map')
    .select('supplier_id, product_id')
    .eq('id', mapId)
    .maybeSingle()

  const { error } = await supabase
    .from('supplier_product_map')
    .delete()
    .eq('id', mapId)

  if (error) throw error

  // Remove the corresponding stock row so it no longer counts toward availability
  if (row?.supplier_id && row?.product_id) {
    await supabase
      .from('supplier_product_stock')
      .delete()
      .eq('supplier_id', row.supplier_id)
      .eq('product_id', row.product_id)
  }
}

// ============================================================
// BRAND helpers (for dropdowns + creation)
// ============================================================

type BrandPayload = {
  brand_name: string
  brand_slug: string
  brand_logo?: string | null
  brand_banner_image?: string | null
  brand_description?: string | null
  brand_short_description?: string | null
  country_of_brand?: string | null
  manufacturer_name?: string | null
  brand_positioning?: string | null
  warranty_info?: string | null
  seo_title?: string | null
  seo_description?: string | null
  is_active?: boolean
  show_on_website?: boolean
  channel_wholesale?: boolean
  channel_retail?: boolean
  channel_marketplaces?: boolean
}

export async function createBrand(payload: BrandPayload) {
  await redis?.del('admin:brands')
  const { data, error } = await supabase.from('brands').insert({
    brand_name: payload.brand_name,
    brand_slug: payload.brand_slug,
    brand_logo: payload.brand_logo ?? null,
    brand_banner_image: payload.brand_banner_image ?? null,
    brand_description: payload.brand_description ?? null,
    brand_short_description: payload.brand_short_description ?? null,
    country_of_brand: payload.country_of_brand ?? null,
    manufacturer_name: payload.manufacturer_name ?? null,
    brand_positioning: payload.brand_positioning ?? null,
    warranty_info: payload.warranty_info ?? null,
    seo_title: payload.seo_title ?? null,
    seo_description: payload.seo_description ?? null,
    is_active: payload.is_active ?? true,
    show_on_website: payload.show_on_website ?? false,
    channel_wholesale: payload.channel_wholesale ?? false,
    channel_retail: payload.channel_retail ?? false,
    channel_marketplaces: payload.channel_marketplaces ?? false,
  }).select('brand_id, brand_name, brand_slug').single()
  if (error) throw error
  return data
}

type BrandsFullResult = { data: Record<string, unknown>[]; total: number; page: number; limit: number; totalPages: number }

export async function listBrandsFull(params: { page: number; limit: number; search?: string }): Promise<BrandsFullResult> {
  const { page, limit, search } = params
  const cacheKey = `admin:brands-full:${page}:${limit}:${search ?? ''}`
  const localCached = getMetaCache<BrandsFullResult>(cacheKey)
  if (localCached) return localCached

  const cols = 'brand_id, brand_name, brand_slug, brand_logo, brand_banner_image, brand_description, brand_short_description, country_of_brand, manufacturer_name, brand_positioning, warranty_info, seo_title, seo_description, is_active, show_on_website, channel_wholesale, channel_retail, channel_marketplaces, created_at, updated_at'
  let q = supabase
    .from('brands')
    .select(cols, { count: 'exact' })
    .order('brand_name', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)
  if (search) q = q.ilike('brand_name', `%${search}%`)
  const { data, count, error } = await q
  if (error) throw error
  const total = count ?? 0
  const result = { data: data ?? [], total, page, limit, totalPages: Math.ceil(total / limit) }
  setMetaCache(cacheKey, result, 300_000) // 5 min TTL
  return result
}

export async function listBrandsAll() {
  const { data, error } = await supabase
    .from('brands')
    .select('brand_id, brand_name, brand_slug')
    .eq('is_active', true)
    .order('brand_name', { ascending: true })
    .limit(1000)
  if (error) throw error
  return data ?? []
}

export async function listBrands() {
  const cached = await redis?.get<{ brand_id: string; brand_name: string }[]>('admin:brands')
  if (cached) return cached

  const { data } = await supabase
    .from('brands').select('brand_id, brand_name, brand_slug').eq('is_active', true).order('brand_name')
  await redis?.set('admin:brands', data ?? [], { ex: TTL.SUPPLIER_MAP })
  return data ?? []
}

function bustBrandsFullCache() {
  for (const key of metaCache.keys()) {
    if (key.startsWith('admin:brands-full:')) metaCache.delete(key)
  }
}

export async function updateBrand(id: string, payload: Partial<BrandPayload>) {
  await redis?.del('admin:brands')
  bustBrandsFullCache()
  const { error } = await supabase.from('brands').update(payload).eq('brand_id', id)
  if (error) throw error

  if (payload.is_active === false) {
    const [pErr, sErr] = await Promise.all([
      supabase.from('patterns').update({ is_active: false, show_on_website: false }).eq('brand_id', id).then(r => r.error),
      supabase.from('skus').update({ status: 'inactive' }).eq('brand_id', id).then(r => r.error),
    ])
    if (pErr) throw pErr
    if (sErr) throw sErr
  }
}

export async function deleteBrand(id: string) {
  await redis?.del('admin:brands')
  bustBrandsFullCache()
  const { error } = await supabase.from('brands').delete().eq('brand_id', id)
  if (error) throw error
}

// ── Patterns ──────────────────────────────────────────────────────────────────

const PATTERNS_META_CACHE_KEY = 'admin:patterns-meta'

export async function listPatternsForMeta(): Promise<{ pattern_id: string; brand_id: string; pattern_name: string }[]> {
  const cached = await redis?.get<{ pattern_id: string; brand_id: string; pattern_name: string }[]>(PATTERNS_META_CACHE_KEY)
    ?? getMetaCache<{ pattern_id: string; brand_id: string; pattern_name: string }[]>(PATTERNS_META_CACHE_KEY)
  if (cached) return cached

  const { data, error } = await supabase
    .from('patterns')
    .select('pattern_id, brand_id, pattern_name')
    .eq('is_active', true)
    .order('pattern_name', { ascending: true })
    .limit(1000)
  if (error) throw error
  const result = data ?? []
  await redis?.set(PATTERNS_META_CACHE_KEY, result, { ex: TTL.SUPPLIER_MAP })
  setMetaCache(PATTERNS_META_CACHE_KEY, result)
  return result
}

function bustPatternsMetaCache() {
  metaCache.delete(PATTERNS_META_CACHE_KEY)
  redis?.del(PATTERNS_META_CACHE_KEY).catch(() => null)
}

export async function listPatterns(params: { page: number; limit: number; search?: string; brandId?: string; appType?: string }) {
  const { page, limit, search, brandId, appType } = params
  const selectCols = 'pattern_id, brand_id, pattern_name, pattern_slug, application_type, season_type, terrain_type, is_active, show_on_website, created_at'
  let q = supabase
    .from('patterns')
    .select(selectCols, { count: 'exact' })
    .order('pattern_name', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)
  if (brandId) q = q.eq('brand_id', brandId)
  if (appType) q = q.eq('application_type', appType)
  if (search) q = q.ilike('pattern_name', `%${search}%`)
  const { data, count, error } = await q
  if (error) throw error
  const total = count ?? 0
  return { data: data ?? [], total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getPattern(patternId: string) {
  const { data, error } = await supabase
    .from('patterns')
    .select('*, pattern_categories(category_id, categories(category_id, category_name, category_type))')
    .eq('pattern_id', patternId)
    .single()
  if (error) throw error
  return data
}

export type PatternPayload = {
  brand_id: string
  pattern_name: string
  pattern_slug: string
  pattern_description?: string | null
  pattern_short_description?: string | null
  main_image?: string | null
  application_type: string
  season_type?: string | null
  performance_category?: string | null
  position_category?: string | null
  shoulder_type?: string | null
  terrain_type?: string | null
  default_country_of_origin?: string | null
  warranty_km?: number | null
  seo_title?: string | null
  seo_description?: string | null
  is_active?: boolean
  show_on_website?: boolean
  on_sale?: boolean
  discountable?: boolean
  tyre_overview?: string | null
  features?: string | null
  warranty_information?: string | null
}

export async function createPattern(payload: PatternPayload) {
  const { category_ids, categoryIds, ...patternData } = payload as PatternPayload & { category_ids?: string[]; categoryIds?: string[] }
  const { data, error } = await supabase
    .from('patterns')
    .insert(patternData)
    .select('pattern_id, pattern_name, brand_id')
    .single()
  if (error) throw error

  const ids = category_ids ?? categoryIds ?? []
  if (ids.length > 0) {
    await supabase.from('pattern_categories').insert(ids.map(cid => ({ pattern_id: data.pattern_id, category_id: cid })))
  }
  bustPatternsMetaCache()
  return data
}

export async function updatePattern(patternId: string, payload: Partial<PatternPayload>) {
  const { category_ids, categoryIds, ...patternData } = payload as Partial<PatternPayload> & { category_ids?: string[]; categoryIds?: string[] }
  const { error } = await supabase
    .from('patterns')
    .update({ ...patternData, updated_at: new Date().toISOString() })
    .eq('pattern_id', patternId)
  if (error) throw error

  const ids = category_ids ?? categoryIds
  if (ids !== undefined) {
    await supabase.from('pattern_categories').delete().eq('pattern_id', patternId)
    if (ids.length > 0) {
      await supabase.from('pattern_categories').insert(ids.map(cid => ({ pattern_id: patternId, category_id: cid })))
    }
  }
  bustPatternsMetaCache()
}

export async function deletePattern(patternId: string) {
  const { error } = await supabase
    .from('patterns')
    .delete()
    .eq('pattern_id', patternId)
  if (error) throw error
  bustPatternsMetaCache()
}

export async function listCollections() {
  const cached = await redis?.get<unknown[]>('admin:collections') ?? getMetaCache<unknown[]>('admin:collections')
  if (cached) return cached

  const { data } = await supabase
    .from('collections').select('collection_id, collection_name, collection_slug, description, is_active, created_at').order('created_at', { ascending: false }).limit(200)
  const result = data ?? []
  await redis?.set('admin:collections', result, { ex: TTL.SUPPLIER_MAP })
  setMetaCache('admin:collections', result)
  return result
}

export async function createCollection(payload: { collection_name: string; collection_slug: string; description?: string }) {
  const { data, error } = await supabase.from('collections').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateCollection(id: string, payload: { collection_name?: string; collection_slug?: string; description?: string; is_active?: boolean }) {
  const { error } = await supabase.from('collections').update(payload).eq('collection_id', id)
  if (error) throw error
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from('collections').delete().eq('collection_id', id)
  if (error) throw error
}

export async function listCategories() {
  const cached = await redis?.get<unknown[]>('admin:categories') ?? getMetaCache<unknown[]>('admin:categories')
  if (cached) return cached

  const { data } = await supabase
    .from('categories')
    .select('category_id, category_name, category_slug, category_type, parent_category_id, description, image, is_active, hidden_from_website, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(500)
  const result = data ?? []
  await redis?.set('admin:categories', result, { ex: TTL.SUPPLIER_MAP })
  setMetaCache('admin:categories', result)
  return result
}

export type CategoryType = 'season' | 'application' | 'performance' | 'position' | 'terrain'

export async function createCategory(payload: {
  category_name: string
  category_slug: string
  category_type: CategoryType
  parent_category_id?: string | null
  description?: string
  image?: string | null
  sort_order?: number
  is_active?: boolean
  hidden_from_website?: boolean
}) {
  const { data, error } = await supabase.from('categories').insert({
    ...payload,
    is_active: payload.is_active ?? true,
    hidden_from_website: payload.hidden_from_website ?? false,
  }).select().single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, payload: {
  category_name?: string
  category_slug?: string
  category_type?: CategoryType
  parent_category_id?: string | null
  description?: string | null
  image?: string | null
  is_active?: boolean
  hidden_from_website?: boolean
  sort_order?: number
}) {
  const { error } = await supabase.from('categories').update(payload).eq('category_id', id)
  if (error) throw error
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('category_id', id)
  if (error) throw error
}

// ── product_categories (SKU-level many-to-many) ────────────────────────────

export async function getProductCategories(productId: string) {
  const { data } = await supabase
    .from('product_categories')
    .select('category_id, categories(category_id, category_name, category_type)')
    .eq('product_id', productId)
  return data ?? []
}

export async function setProductCategories(productId: string, categoryIds: string[]) {
  await supabase.from('product_categories').delete().eq('product_id', productId)
  if (categoryIds.length > 0) {
    const { error } = await supabase.from('product_categories').insert(
      categoryIds.map(cid => ({ product_id: productId, category_id: cid }))
    )
    if (error) throw error
  }
}

// ── Attributes ───────────────────────────────────────────────────────────────

export async function listAttributes() {
  const { data, error } = await supabase
    .from('product_attributes')
    .select('*')
    .order('attribute_type', { ascending: true })
    .order('attribute_value', { ascending: true })
  if (error && error.code !== '42P01') throw error // Ignore relation does not exist error if table not yet created
  return data ?? []
}

export async function createAttribute(payload: { attribute_type: string; attribute_value: string }) {
  if (!payload.attribute_type || !payload.attribute_value) throw new Error('Missing fields')
  const { data, error } = await supabase
    .from('product_attributes')
    .insert({
      attribute_type: payload.attribute_type,
      attribute_value: payload.attribute_value,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateAttribute(id: string, payload: { attribute_value: string }) {
  if (!payload.attribute_value) throw new Error('Missing attribute_value')
  const { error } = await supabase
    .from('product_attributes')
    .update({ attribute_value: payload.attribute_value })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteAttribute(id: string) {
  const { error } = await supabase
    .from('product_attributes')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
