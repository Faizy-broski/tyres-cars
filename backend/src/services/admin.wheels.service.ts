import { supabase } from './supabase.service'

// ============================================================
// Types
// ============================================================

export type WheelStyleCategory = '4x4' | 'street' | 'luxury' | 'commercial'

export type WheelBrandPayload = {
  brand_name:  string
  logo?:        string | null
  description?: string | null
  is_active?:  boolean
}

export type WheelPayload = {
  wheel_brand_id: string
  model_name:     string
  model_slug:     string
  description?:   string | null
  main_image?:    string | null
  gallery_images?: string[]
  style_category?: WheelStyleCategory | null
  finish?:         string | null
  colour?:         string | null
  is_active?:      boolean
}

export type WheelVariantPayload = {
  sku:          string
  diameter:     number
  width:        number
  pcd:          string
  offset:       number
  centre_bore?: number | null
  load_rating?: number | null
  price?:       number | null
  is_active?:   boolean
}

export type WheelListFilters = {
  search?:   string
  brandId?:  string
  isActive?: boolean
  page?:     number
  limit?:    number
}

// ============================================================
// WHEEL BRANDS
// ============================================================

export async function listWheelBrands() {
  // Supabase/PostgREST caps a plain .select() at a default page size (1000
  // rows) — page through so this can't silently truncate as the brand list grows.
  const PAGE = 1000
  const out: unknown[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('wheel_brands')
      .select('wheel_brand_id, brand_name, logo, description, is_active, created_at')
      .order('brand_name')
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return out
}

export async function createWheelBrand(payload: WheelBrandPayload) {
  const { data, error } = await supabase
    .from('wheel_brands')
    .insert({
      brand_name:  payload.brand_name,
      logo:        payload.logo        ?? null,
      description: payload.description ?? null,
      is_active:   payload.is_active   ?? true,
    })
    .select('wheel_brand_id, brand_name, logo, description, is_active, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateWheelBrand(id: string, payload: Partial<WheelBrandPayload>) {
  const allowed: Record<string, unknown> = {}
  if (payload.brand_name  !== undefined) allowed.brand_name  = payload.brand_name
  if (payload.logo        !== undefined) allowed.logo        = payload.logo
  if (payload.description !== undefined) allowed.description = payload.description
  if (payload.is_active   !== undefined) allowed.is_active   = payload.is_active
  const { error } = await supabase.from('wheel_brands').update(allowed).eq('wheel_brand_id', id)
  if (error) throw error
}

export async function deleteWheelBrand(id: string) {
  const { error } = await supabase.from('wheel_brands').delete().eq('wheel_brand_id', id)
  if (error) throw error
}

// ============================================================
// WHEELS (models)
// ============================================================

export async function listWheels(filters: WheelListFilters = {}) {
  const { search = '', brandId = '', isActive, page = 1, limit = 20 } = filters
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let query = supabase
    .from('wheels')
    .select(`
      wheel_id,
      wheel_brand_id,
      model_name,
      model_slug,
      description,
      main_image,
      gallery_images,
      style_category,
      finish,
      colour,
      is_active,
      created_at,
      updated_at,
      wheel_brands ( brand_name ),
      wheel_variants ( wheel_variant_id )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.ilike('model_name', `%${search}%`)
  }
  if (brandId) {
    query = query.eq('wheel_brand_id', brandId)
  }
  if (isActive !== undefined) {
    query = query.eq('is_active', isActive)
  }

  const { data, error, count } = await query
  if (error) throw error

  const rows = (data ?? []).map(row => ({
    ...row,
    variant_count: Array.isArray(row.wheel_variants) ? row.wheel_variants.length : 0,
    wheel_variants: undefined,
  }))

  return { data: rows, total: count ?? 0, page, limit }
}

export async function getWheel(wheelId: string) {
  const { data, error } = await supabase
    .from('wheels')
    .select(`
      wheel_id,
      wheel_brand_id,
      model_name,
      model_slug,
      description,
      main_image,
      gallery_images,
      style_category,
      finish,
      colour,
      is_active,
      created_at,
      updated_at,
      wheel_brands ( brand_name ),
      wheel_variants (
        wheel_variant_id,
        sku,
        diameter,
        width,
        pcd,
        offset,
        centre_bore,
        load_rating,
        price,
        is_active,
        created_at
      )
    `)
    .eq('wheel_id', wheelId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // no matching row — let the controller 404
    throw error
  }
  return data
}

export async function createWheel(payload: WheelPayload) {
  const { data, error } = await supabase
    .from('wheels')
    .insert({
      wheel_brand_id: payload.wheel_brand_id,
      model_name:     payload.model_name,
      model_slug:     payload.model_slug,
      description:    payload.description    ?? null,
      main_image:     payload.main_image     ?? null,
      gallery_images: payload.gallery_images ?? [],
      style_category: payload.style_category ?? null,
      finish:         payload.finish         ?? null,
      colour:         payload.colour         ?? null,
      is_active:      payload.is_active      ?? true,
    })
    .select('wheel_id, model_name, model_slug')
    .single()
  if (error) throw error
  return data
}

export async function updateWheel(id: string, payload: Partial<WheelPayload>) {
  const allowed: Record<string, unknown> = {}
  if (payload.wheel_brand_id !== undefined) allowed.wheel_brand_id = payload.wheel_brand_id
  if (payload.model_name     !== undefined) allowed.model_name     = payload.model_name
  if (payload.model_slug     !== undefined) allowed.model_slug     = payload.model_slug
  if (payload.description    !== undefined) allowed.description    = payload.description
  if (payload.main_image     !== undefined) allowed.main_image     = payload.main_image
  if (payload.gallery_images !== undefined) allowed.gallery_images = payload.gallery_images
  if (payload.style_category !== undefined) allowed.style_category = payload.style_category
  if (payload.finish         !== undefined) allowed.finish         = payload.finish
  if (payload.colour         !== undefined) allowed.colour         = payload.colour
  if (payload.is_active      !== undefined) allowed.is_active      = payload.is_active
  const { error } = await supabase.from('wheels').update(allowed).eq('wheel_id', id)
  if (error) throw error
}

export async function deleteWheel(id: string) {
  const { error } = await supabase.from('wheels').delete().eq('wheel_id', id)
  if (error) throw error
}

// ============================================================
// WHEEL VARIANTS
// ============================================================

export async function addWheelVariant(wheelId: string, payload: WheelVariantPayload) {
  const { data, error } = await supabase
    .from('wheel_variants')
    .insert({
      wheel_id:    wheelId,
      sku:         payload.sku,
      diameter:    payload.diameter,
      width:       payload.width,
      pcd:         payload.pcd,
      offset:      payload.offset,
      centre_bore: payload.centre_bore ?? null,
      load_rating: payload.load_rating ?? null,
      price:       payload.price       ?? null,
      is_active:   payload.is_active   ?? true,
    })
    .select('wheel_variant_id, sku, diameter, width, pcd, offset, centre_bore, load_rating, price, is_active, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateWheelVariant(variantId: string, payload: Partial<WheelVariantPayload>) {
  const allowed: Record<string, unknown> = {}
  if (payload.sku         !== undefined) allowed.sku         = payload.sku
  if (payload.diameter    !== undefined) allowed.diameter    = payload.diameter
  if (payload.width       !== undefined) allowed.width       = payload.width
  if (payload.pcd         !== undefined) allowed.pcd         = payload.pcd
  if (payload.offset      !== undefined) allowed.offset      = payload.offset
  if (payload.centre_bore !== undefined) allowed.centre_bore = payload.centre_bore
  if (payload.load_rating !== undefined) allowed.load_rating = payload.load_rating
  if (payload.price       !== undefined) allowed.price       = payload.price
  if (payload.is_active   !== undefined) allowed.is_active   = payload.is_active
  const { error } = await supabase.from('wheel_variants').update(allowed).eq('wheel_variant_id', variantId)
  if (error) throw error
}

export async function deleteWheelVariant(variantId: string) {
  const { error } = await supabase.from('wheel_variants').delete().eq('wheel_variant_id', variantId)
  if (error) throw error
}
