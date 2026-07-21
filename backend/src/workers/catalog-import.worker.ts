import { Worker, type Job } from 'bullmq'
import { supabase as db } from '../services/supabase.service'
import { normalizeTyreSize } from '../utils/size-normalizer'
import { slugify } from '../utils/slugify'

const connection = {
  url:                  process.env.UPSTASH_REDIS_URL!,
  maxRetriesPerRequest: null as null,
  enableReadyCheck:     false,
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CatalogImportJobData = {
  mode:       'skus' | 'brands' | 'categories' | 'patterns'
  rows:       Record<string, string>[]
  columnMap:  Record<string, string>   // field_key → csv_header
  session_id: string
}

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors:  { row: number; identifier?: string; reason: string }[]
}

// ── Main worker ───────────────────────────────────────────────────────────────

export const catalogImportWorker = new Worker<CatalogImportJobData>(
  'catalog-import',
  async (job: Job<CatalogImportJobData>) => {
    const { mode, rows, columnMap } = job.data
    console.log(`[CatalogImport] mode=${mode} rows=${rows.length}`)

    const progress = (pct: number) => job.updateProgress(Math.round(pct))

    switch (mode) {
      case 'brands':     return importBrands(rows, columnMap, progress)
      case 'categories': return importCategories(rows, columnMap, progress)
      case 'skus':       return importSkus(rows, columnMap, progress)
      case 'patterns':   return importPatterns(rows, columnMap, progress)
    }
  },
  { connection, concurrency: 1 },
)

catalogImportWorker.on('failed', (job, err) => {
  console.error(`[CatalogImport] Job ${job?.id} failed:`, err.message)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function get(row: Record<string, string>, columnMap: Record<string, string>, field: string): string {
  const header = columnMap[field]
  return header ? (row[header] ?? '').trim() : ''
}

function bool(v: string): boolean {
  return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes'
}

function num(v: string): number | undefined {
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

function int(v: string): number | undefined {
  const n = parseInt(v, 10)
  return isNaN(n) ? undefined : n
}

// ── Brand import ──────────────────────────────────────────────────────────────

async function importBrands(
  rows:      Record<string, string>[],
  columnMap: Record<string, string>,
  progress:  (pct: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    progress((i / rows.length) * 100)
    const row = rows[i]
    const g = (f: string) => get(row, columnMap, f)

    const brand_name = g('brand_name')
    if (!brand_name) {
      result.errors.push({ row: i + 2, reason: 'brand_name is required' })
      continue
    }

    const brand_slug = g('brand_slug') || slugify(brand_name)

    const payload: Record<string, unknown> = {
      brand_name,
      brand_slug,
      updated_at: new Date().toISOString(),
    }

    if (g('brand_positioning'))        payload.brand_positioning        = g('brand_positioning')
    if (g('country_of_brand'))         payload.country_of_brand         = g('country_of_brand')
    if (g('manufacturer_name'))        payload.manufacturer_name        = g('manufacturer_name')
    if (g('brand_description'))        payload.brand_description        = g('brand_description')
    if (g('brand_short_description'))  payload.brand_short_description  = g('brand_short_description')
    if (g('warranty_info'))            payload.warranty_info            = g('warranty_info')
    if (g('seo_title'))                payload.seo_title                = g('seo_title')
    if (g('seo_description'))          payload.seo_description          = g('seo_description')
    if (g('is_active'))                payload.is_active                = bool(g('is_active'))
    if (g('show_on_website'))          payload.show_on_website          = bool(g('show_on_website'))
    if (g('channel_retail'))           payload.channel_retail           = bool(g('channel_retail'))
    if (g('channel_wholesale'))        payload.channel_wholesale        = bool(g('channel_wholesale'))
    if (g('channel_marketplaces'))     payload.channel_marketplaces     = bool(g('channel_marketplaces'))

    try {
      // Check if already exists
      const { data: existing } = await db.from('brands').select('brand_id').eq('brand_slug', brand_slug).maybeSingle()

      const { error } = await db.from('brands').upsert(payload, { onConflict: 'brand_slug' })
      if (error) throw error

      existing ? result.updated++ : result.created++
    } catch (err: any) {
      result.errors.push({ row: i + 2, identifier: brand_name, reason: err.message })
    }
  }

  progress(100)
  return result
}

// ── Category import ───────────────────────────────────────────────────────────

async function importCategories(
  rows:      Record<string, string>[],
  columnMap: Record<string, string>,
  progress:  (pct: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // Pre-load existing categories into a name→id map
  const { data: existing } = await db.from('categories').select('category_id, category_name, category_slug')
  const nameToId = new Map<string, string>()
  for (const c of existing ?? []) {
    nameToId.set(c.category_name.toLowerCase(), c.category_id)
    nameToId.set(c.category_slug, c.category_id)
  }

  // Topological sort — parents before children
  // Build a set of all names in this CSV
  const csvNames = new Set(rows.map(r => get(r, columnMap, 'category_name').toLowerCase()).filter(Boolean))

  // Detect and sort: rows without a CSV parent come first
  const sorted: Record<string, string>[] = []
  const inSorted = new Set<string>()
  const maxPasses = rows.length + 1

  let remaining = [...rows]
  for (let pass = 0; pass < maxPasses && remaining.length > 0; pass++) {
    const nextRemaining: Record<string, string>[] = []
    for (const row of remaining) {
      const name       = get(row, columnMap, 'category_name').toLowerCase()
      const parentName = get(row, columnMap, 'parent_category_name').toLowerCase()

      // Circular dependency check
      if (parentName && parentName === name) {
        result.errors.push({ row: sorted.length + nextRemaining.length + 2, identifier: name, reason: 'Category cannot be its own parent' })
        continue
      }

      // Parent is not in CSV, or parent already sorted → safe to insert now
      const parentInCsv       = parentName && csvNames.has(parentName)
      const parentAlreadyDone = !parentName || !parentInCsv || inSorted.has(parentName) || nameToId.has(parentName)

      if (parentAlreadyDone) {
        sorted.push(row)
        inSorted.add(name)
      } else {
        nextRemaining.push(row)
      }
    }
    remaining = nextRemaining
  }

  // Any rows still remaining are in a circular chain
  for (const row of remaining) {
    const name = get(row, columnMap, 'category_name')
    result.errors.push({ identifier: name, row: 0, reason: 'Circular parent dependency — category skipped' })
  }

  for (let i = 0; i < sorted.length; i++) {
    progress((i / sorted.length) * 100)
    const row = sorted[i]
    const g = (f: string) => get(row, columnMap, f)

    const category_name = g('category_name')
    const category_type = g('category_type')
    if (!category_name || !category_type) {
      result.errors.push({ row: i + 2, reason: 'category_name and category_type are required' })
      continue
    }

    const category_slug = g('category_slug') || slugify(category_name)

    // Resolve parent
    let parent_category_id: string | null = null
    const parentName = g('parent_category_name')
    if (parentName) {
      parent_category_id = nameToId.get(parentName.toLowerCase()) ?? null
      if (!parent_category_id) {
        result.errors.push({ row: i + 2, identifier: category_name, reason: `Parent category "${parentName}" not found` })
        continue
      }
    }

    const payload: Record<string, unknown> = {
      category_name,
      category_type,
      category_slug,
      parent_category_id,
    }
    if (g('description'))         payload.description          = g('description')
    if (g('sort_order'))          payload.sort_order           = int(g('sort_order')) ?? 0
    if (g('is_active'))           payload.is_active            = bool(g('is_active'))
    if (g('hidden_from_website')) payload.hidden_from_website  = bool(g('hidden_from_website'))

    try {
      const alreadyExists = nameToId.has(category_slug)
      const { data, error } = await db.from('categories')
        .upsert(payload, { onConflict: 'category_slug' })
        .select('category_id')
        .single()
      if (error) throw error

      // Update our name→id map for subsequent children
      nameToId.set(category_name.toLowerCase(), data.category_id)
      nameToId.set(category_slug, data.category_id)

      alreadyExists ? result.updated++ : result.created++
    } catch (err: any) {
      result.errors.push({ row: i + 2, identifier: category_name, reason: err.message })
    }
  }

  progress(100)
  return result
}

// ── SKU import ────────────────────────────────────────────────────────────────

async function importSkus(
  rows:      Record<string, string>[],
  columnMap: Record<string, string>,
  progress:  (pct: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // Warehouse name→id cache (populated on first use)
  const warehouseCache = new Map<string, string>()

  async function resolveWarehouse(name: string): Promise<string | null> {
    if (warehouseCache.has(name)) return warehouseCache.get(name)!
    const { data } = await db.from('warehouses').select('warehouse_id').eq('warehouse_name', name).maybeSingle()
    if (data) {
      warehouseCache.set(name, data.warehouse_id)
      return data.warehouse_id
    }
    return null
  }

  for (let i = 0; i < rows.length; i++) {
    progress((i / rows.length) * 100)
    const row = rows[i]
    const g = (f: string) => get(row, columnMap, f)

    // ── Required fields ──
    const sku              = g('sku')
    const brand_name       = g('brand_name')
    const pattern_name     = g('pattern_name')
    const tyre_size_display = g('tyre_size_display')
    const country_of_origin = g('country_of_origin')
    const retail_price_raw  = g('retail_price_inc_gst')

    if (!sku || !brand_name || !pattern_name || !tyre_size_display || !country_of_origin || !retail_price_raw) {
      result.errors.push({
        row: i + 2,
        identifier: sku || '(no sku)',
        reason: `Missing required field(s): ${[
          !sku && 'sku', !brand_name && 'brand_name', !pattern_name && 'pattern_name',
          !tyre_size_display && 'tyre_size_display', !country_of_origin && 'country_of_origin',
          !retail_price_raw && 'retail_price_inc_gst',
        ].filter(Boolean).join(', ')}`,
      })
      continue
    }

    try {
      // ── 1. Upsert brand ──
      const brand_slug = g('brand_slug') || slugify(brand_name)
      const brandPayload: Record<string, unknown> = {
        brand_name,
        brand_slug,
        updated_at: new Date().toISOString(),
      }
      if (g('brand_positioning'))    brandPayload.brand_positioning    = g('brand_positioning')
      if (g('country_of_brand'))     brandPayload.country_of_brand     = g('country_of_brand')
      if (g('manufacturer_name'))    brandPayload.manufacturer_name    = g('manufacturer_name')
      if (g('channel_retail'))       brandPayload.channel_retail       = bool(g('channel_retail'))
      if (g('channel_wholesale'))    brandPayload.channel_wholesale    = bool(g('channel_wholesale'))
      if (g('channel_marketplaces')) brandPayload.channel_marketplaces = bool(g('channel_marketplaces'))

      const { data: brandData, error: brandErr } = await db
        .from('brands')
        .upsert(brandPayload, { onConflict: 'brand_slug' })
        .select('brand_id')
        .single()
      if (brandErr) throw new Error(`Brand upsert: ${brandErr.message}`)
      const brand_id = brandData.brand_id

      // ── 2. Upsert pattern (only overwrite fields if pattern is new) ──
      const pattern_slug = g('pattern_slug') || slugify(pattern_name)

      const { data: existingPattern } = await db
        .from('patterns')
        .select('pattern_id')
        .eq('brand_id', brand_id)
        .eq('pattern_slug', pattern_slug)
        .maybeSingle()

      let pattern_id: string

      if (existingPattern) {
        pattern_id = existingPattern.pattern_id
      } else {
        const patternPayload: Record<string, unknown> = {
          brand_id,
          pattern_name,
          pattern_slug,
          application_type: g('application_type') || 'PCR',
          updated_at: new Date().toISOString(),
        }
        if (g('season_type'))                  patternPayload.season_type                  = g('season_type')
        if (g('performance_category'))         patternPayload.performance_category         = g('performance_category')
        if (g('position_category'))            patternPayload.position_category            = g('position_category')
        if (g('shoulder_type'))                patternPayload.shoulder_type                = g('shoulder_type')
        if (g('terrain_type'))                 patternPayload.terrain_type                 = g('terrain_type')
        if (g('pattern_description'))          patternPayload.pattern_description          = g('pattern_description')
        if (g('pattern_short_description'))    patternPayload.pattern_short_description    = g('pattern_short_description')
        if (g('default_country_of_origin'))    patternPayload.default_country_of_origin    = g('default_country_of_origin')
        if (g('warranty_km'))                  patternPayload.warranty_km                  = int(g('warranty_km'))
        if (g('on_sale'))                      patternPayload.on_sale                      = bool(g('on_sale'))
        if (g('discountable'))                 patternPayload.discountable                 = bool(g('discountable'))
        if (g('tags'))                         patternPayload.tags                         = g('tags').split(';').map(t => t.trim()).filter(Boolean)

        const { data: newPattern, error: patErr } = await db
          .from('patterns')
          .insert(patternPayload)
          .select('pattern_id')
          .single()
        if (patErr) throw new Error(`Pattern insert: ${patErr.message}`)
        pattern_id = newPattern.pattern_id
      }

      // ── 3. Upsert SKU ──
      const normalized_size_code = normalizeTyreSize(tyre_size_display)
      const product_slug = `${slugify(brand_name)}-${slugify(pattern_name)}-${normalized_size_code}-${sku}`
        .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

      const skuPayload: Record<string, unknown> = {
        sku,
        brand_id,
        pattern_id,
        tyre_size_display,
        normalized_size_code,
        country_of_origin,
        updated_at: new Date().toISOString(),
      }

      // product_slug only on insert (INSERT ... ON CONFLICT DO UPDATE should not overwrite slug)
      // We handle this by checking existence first
      const { data: existingSku } = await db.from('skus').select('product_id').eq('sku', sku).maybeSingle()
      if (!existingSku) skuPayload.product_slug = product_slug

      // Optional SKU fields
      if (g('width'))              skuPayload.width              = num(g('width'))
      if (g('profile'))            skuPayload.profile            = num(g('profile'))
      if (g('rim_size'))           skuPayload.rim_size           = num(g('rim_size'))
      if (g('special_size'))       skuPayload.special_size       = g('special_size')
      if (g('barcode_ean'))        skuPayload.barcode_ean        = g('barcode_ean')
      if (g('lt_sizing'))          skuPayload.lt_sizing          = bool(g('lt_sizing'))
      if (g('construction_type'))  skuPayload.construction_type  = g('construction_type')
      if (g('load_index'))         skuPayload.load_index         = g('load_index')
      if (g('speed_rating'))       skuPayload.speed_rating       = g('speed_rating')
      if (g('xl_reinforced'))      skuPayload.xl_reinforced      = bool(g('xl_reinforced'))
      if (g('runflat'))            skuPayload.runflat            = bool(g('runflat'))
      if (g('ply_rating'))         skuPayload.ply_rating         = g('ply_rating')
      if (g('load_range'))         skuPayload.load_range         = g('load_range')
      if (g('sidewall'))           skuPayload.sidewall           = g('sidewall')
      if (g('tube_type'))          skuPayload.tube_type          = g('tube_type')
      if (g('factory_name'))       skuPayload.factory_name       = g('factory_name')
      if (g('factory_country'))    skuPayload.factory_country    = g('factory_country')
      if (g('manufacturer_name'))  skuPayload.manufacturer_name  = g('manufacturer_name')
      if (g('tread_depth'))        skuPayload.tread_depth        = num(g('tread_depth'))
      if (g('tyre_weight'))        skuPayload.tyre_weight        = num(g('tyre_weight'))
      if (g('overall_diameter'))   skuPayload.overall_diameter   = num(g('overall_diameter'))
      if (g('section_width'))      skuPayload.section_width      = num(g('section_width'))
      if (g('max_load'))           skuPayload.max_load           = g('max_load')
      if (g('max_pressure'))       skuPayload.max_pressure       = g('max_pressure')
      if (g('wet_grip'))           skuPayload.wet_grip           = g('wet_grip')
      if (g('fuel_rating'))        skuPayload.fuel_rating        = g('fuel_rating')
      // "0" is this source's "no data" sentinel for noise, unlike fuel/wet which are left blank
      if (g('noise_db') && g('noise_db') !== '0') skuPayload.noise_db = g('noise_db')
      if (g('noise_class'))        skuPayload.noise_class        = g('noise_class')
      if (g('e_mark'))             skuPayload.e_mark             = g('e_mark')
      if (g('dot_code'))           skuPayload.dot_code           = g('dot_code')
      if (g('utqg'))               skuPayload.utqg               = g('utqg')
      if (g('status'))             skuPayload.status             = g('status')
      if (g('cost_price'))         skuPayload.cost_price         = num(g('cost_price'))
      if (g('compare_at_price'))   skuPayload.compare_at_price   = num(g('compare_at_price'))
      if (g('seo_title'))          skuPayload.seo_title          = g('seo_title')
      if (g('seo_description'))    skuPayload.seo_description    = g('seo_description')

      const { data: skuData, error: skuErr } = await db
        .from('skus')
        .upsert(skuPayload, { onConflict: 'sku' })
        .select('product_id')
        .single()
      if (skuErr) throw new Error(`SKU upsert: ${skuErr.message}`)
      const product_id = skuData.product_id

      existingSku ? result.updated++ : result.created++

      // ── 4. Retail price ──
      const retail_price_inc_gst = parseFloat(retail_price_raw)
      if (!isNaN(retail_price_inc_gst)) {
        const price_ex_gst = +(retail_price_inc_gst / 1.1).toFixed(2)
        await db.from('product_prices').upsert(
          { product_id, price_type: 'retail', price_inc_gst: retail_price_inc_gst, price_ex_gst, is_active: true },
          { onConflict: 'product_id,price_type' },
        )
      }

      // ── 5. Wholesale price ──
      const wholesale_raw = g('wholesale_price_inc_gst')
      if (wholesale_raw) {
        const wholesale_inc = parseFloat(wholesale_raw)
        if (!isNaN(wholesale_inc)) {
          const wholesale_ex = +(wholesale_inc / 1.1).toFixed(2)
          await db.from('product_prices').upsert(
            { product_id, price_type: 'wholesale', price_inc_gst: wholesale_inc, price_ex_gst: wholesale_ex, is_active: true },
            { onConflict: 'product_id,price_type' },
          )
        }
      }

      // ── 6. Stock ──
      const warehouse_name  = g('warehouse_name')
      const available_stock = g('available_stock')
      if (warehouse_name && available_stock) {
        const warehouse_id = await resolveWarehouse(warehouse_name)
        if (warehouse_id) {
          const stock = int(available_stock) ?? 0
          await db.from('product_stock').upsert(
            { product_id, warehouse_id, available_stock: stock },
            { onConflict: 'product_id,warehouse_id' },
          )
        } else {
          result.errors.push({ row: i + 2, identifier: sku, reason: `Warehouse "${warehouse_name}" not found — stock skipped` })
        }
      }
    } catch (err: any) {
      result.errors.push({ row: i + 2, identifier: sku, reason: err.message })
    }
  }

  progress(100)
  return result
}

// ── Pattern import ────────────────────────────────────────────────────────────

async function importPatterns(
  rows:      Record<string, string>[],
  columnMap: Record<string, string>,
  progress:  (pct: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // Brand name→id cache
  const brandCache = new Map<string, string>()

  async function resolveBrand(brand_name: string): Promise<string> {
    const key = brand_name.toLowerCase()
    if (brandCache.has(key)) return brandCache.get(key)!
    const brand_slug = slugify(brand_name)
    const { data, error } = await db
      .from('brands')
      .upsert({ brand_name, brand_slug, updated_at: new Date().toISOString() }, { onConflict: 'brand_slug' })
      .select('brand_id')
      .single()
    if (error) throw new Error(`Brand upsert: ${error.message}`)
    brandCache.set(key, data.brand_id)
    return data.brand_id
  }

  for (let i = 0; i < rows.length; i++) {
    progress((i / rows.length) * 100)
    const row = rows[i]
    const g = (f: string) => get(row, columnMap, f)

    const brand_name   = g('brand_name')
    const pattern_name = g('pattern_name')

    if (!brand_name || !pattern_name) {
      result.errors.push({ row: i + 2, reason: 'brand_name and pattern_name are required' })
      continue
    }

    try {
      const brand_id     = await resolveBrand(brand_name)
      const pattern_slug = g('pattern_slug') || slugify(pattern_name)

      const payload: Record<string, unknown> = {
        brand_id,
        pattern_name,
        pattern_slug,
        updated_at: new Date().toISOString(),
      }

      if (g('application_type'))            payload.application_type            = g('application_type')
      if (g('season_type'))                 payload.season_type                 = g('season_type')
      if (g('performance_category'))        payload.performance_category        = g('performance_category')
      if (g('position_category'))           payload.position_category           = g('position_category')
      if (g('shoulder_type'))               payload.shoulder_type               = g('shoulder_type')
      if (g('terrain_type'))                payload.terrain_type                = g('terrain_type')
      if (g('pattern_description'))         payload.pattern_description         = g('pattern_description')
      if (g('pattern_short_description'))   payload.pattern_short_description   = g('pattern_short_description')
      if (g('default_country_of_origin'))   payload.default_country_of_origin   = g('default_country_of_origin')
      if (g('warranty_km'))                 payload.warranty_km                 = int(g('warranty_km'))
      if (g('on_sale'))                     payload.on_sale                     = bool(g('on_sale'))
      if (g('discountable'))                payload.discountable                = bool(g('discountable'))
      if (g('tags'))                        payload.tags                        = g('tags').split(';').map(t => t.trim()).filter(Boolean)
      if (g('is_active'))                   payload.is_active                   = bool(g('is_active'))
      if (g('show_on_website'))             payload.show_on_website             = bool(g('show_on_website'))
      if (g('seo_title'))                   payload.seo_title                   = g('seo_title')
      if (g('seo_description'))             payload.seo_description             = g('seo_description')

      const { data: existing } = await db
        .from('patterns')
        .select('pattern_id')
        .eq('brand_id', brand_id)
        .eq('pattern_slug', pattern_slug)
        .maybeSingle()

      const { error } = await db
        .from('patterns')
        .upsert(payload, { onConflict: 'brand_id,pattern_slug' })
      if (error) throw new Error(`Pattern upsert: ${error.message}`)

      existing ? result.updated++ : result.created++
    } catch (err: any) {
      result.errors.push({ row: i + 2, identifier: `${brand_name} / ${pattern_name}`, reason: err.message })
    }
  }

  progress(100)
  return result
}
