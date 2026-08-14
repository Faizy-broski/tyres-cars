import { supabase } from './supabase.service'
import { catalogueSyncQueue } from '../queues'
import { redis } from './redis.service'
import type { CatalogueSyncJobData } from '../workers/catalogue-sync.worker'

const inventoryCache = new Map<string, { data: unknown; exp: number }>()

// Shared, Redis-backed cache-generation counter — see the identical pattern in
// products.service.ts's listBrandsFull/bustBrandsFullCache for why this exists:
// this cache is paginated (many keys per query), so a plain local-Map bust only
// clears the fork that handled the write, leaving other PM2 forks serving a
// stale page until its TTL expires. Bumping this one shared key instantly
// orphans every previously-cached page on every fork.
const INVENTORY_VERSION_KEY = 'inv:version'

export type InventoryStatusFilter = 'all' | 'mapped' | 'unmapped' | 'pending'

export type SupplierMappingEntry = {
  map_id:                string
  supplier_id:           string
  supplier_name:         string
  connection_type:       string
  supplier_sku:          string | null
  supplier_brand_name:   string | null
  supplier_pattern_name: string | null
  supplier_size_raw:     string | null
  supplier_price:        number | null
  supplier_stock:        number | null
  match_confidence:      number | null
  is_verified:           boolean
  synced_price:          number | null
  synced_qty:            number | null
  status:                'synced' | 'mapped' | 'pending_review'
}

export type InventoryProductRow = {
  product_id:         string
  sku:                string
  tyre_size_display:  string
  brand_name:         string | null
  pattern_name:       string | null
  own_stock:          number
  supplier_mappings:  SupplierMappingEntry[]
}

/** Normalize a tyre-size search term and return all useful variants to OR together.
 *  Handles: "195/65R15", "195 65R15", "195-65R15", "19565R15", "100100R18" etc.
 */
function buildSizeVariants(raw: string): string[] {
  const up       = raw.trim().toUpperCase()
  const noSpaces = up.replace(/\s+/g, '')
  const noDash   = noSpaces.replace(/-/g, '/')     // 195-65R15  → 195/65R15
  const noSlash  = noSpaces.replace(/\//g, '')     // 195/65R15  → 19565R15

  const variants = new Set<string>([up, noSpaces, noDash, noSlash])

  // Smart slash insertion: "19565R15" or "100100R18" — match W(3 digits) + A(2-3 digits) + R + rim
  const m = noSlash.match(/^(\d{3})(\d{2,3})(R\d{2,3})$/)
  if (m) variants.add(`${m[1]}/${m[2]}${m[3]}`)

  return [...variants].filter(Boolean)
}

export async function bustInventoryCache() {
  inventoryCache.clear()
  await redis?.incr(INVENTORY_VERSION_KEY).catch(() => null)
}

export async function getInventoryMappings({
  page       = 1,
  limit      = 20,
  supplierId = '',
  status     = 'all' as InventoryStatusFilter,
  q          = '',
}) {
  // A Redis read failure here must degrade to "treat as cache miss, hit the DB" — never a 500.
  const version  = (await redis?.get<number>(INVENTORY_VERSION_KEY).catch(() => null)) ?? 0
  const cacheKey = `inv:v${version}:${page}:${limit}:${supplierId}:${status}:${q}`
  const localHit = inventoryCache.get(cacheKey)
  if (localHit && localHit.exp > Date.now()) return localHit.data as { data: InventoryProductRow[]; total: number }
  const remoteHit = await redis?.get<{ data: InventoryProductRow[]; total: number }>(cacheKey).catch(() => null)
  if (remoteHit) return remoteHit

  const offset = (page - 1) * limit
  const search = q.trim()

  // ── Step 1: Resolve product_id filter set for status filters ──────────────
  let includeIds:  string[] | null = null   // null = no filter (all)
  let excludeIds:  string[] | null = null   // null = no exclusion

  if (status !== 'all') {
    let mapQuery = supabase
      .from('supplier_product_map')
      .select('product_id, is_verified')
      .not('product_id', 'is', null)
    if (supplierId) mapQuery = mapQuery.eq('supplier_id', supplierId)

    const { data: allMaps } = await mapQuery

    const anyMapped  = new Set((allMaps ?? []).map(m => m.product_id as string))
    const verified   = new Set((allMaps ?? []).filter(m => m.is_verified).map(m => m.product_id as string))
    const pending    = new Set((allMaps ?? []).filter(m => !m.is_verified).map(m => m.product_id as string))

    if (status === 'mapped')   includeIds = [...verified]
    if (status === 'pending')  includeIds = [...pending]
    if (status === 'unmapped') excludeIds = [...anyMapped]

    // Short-circuit if include list is empty
    if ((status === 'mapped' || status === 'pending') && includeIds!.length === 0) {
      return { data: [], total: 0 }
    }
  }

  // ── Step 2: Query our SKUs (LEFT side — always) ───────────────────────────
  let skusQ = supabase
    .from('skus')
    .select(`
      product_id,
      sku,
      tyre_size_display,
      brands:brand_id ( brand_name ),
      patterns:pattern_id ( pattern_name )
    `, { count: 'exact' })
    .eq('status', 'active')
    .order('tyre_size_display')

  if (search) {
    const { data: b } = await supabase.from('brands').select('brand_id').ilike('brand_name', `%${search}%`)
    const { data: p } = await supabase.from('patterns').select('pattern_id').ilike('pattern_name', `%${search}%`)

    const bIds = b?.map(x => x.brand_id) || []
    const pIds = p?.map(x => x.pattern_id) || []

    // Build normalized size variants to handle "195 65R15", "195-65R15", "19565R15" etc.
    const sizeVariants = buildSizeVariants(search)

    // All conditions go into a single .or() so they're OR-ed (chaining .or() calls ANDs them).
    // Strip parens from size strings to avoid breaking PostgREST filter grammar.
    const orParts: string[] = []
    for (const v of sizeVariants) {
      const safe = v.replace(/[(),]/g, '') // strip chars that break PostgREST or() grammar
      orParts.push(`tyre_size_display.ilike.%${safe}%`, `sku.ilike.%${safe}%`)
    }
    if (bIds.length > 0) orParts.push(`brand_id.in.(${bIds.join(',')})`)
    if (pIds.length > 0) orParts.push(`pattern_id.in.(${pIds.join(',')})`)

    skusQ = skusQ.or(orParts.join(','))
  }
  if (includeIds !== null) skusQ = skusQ.in('product_id', includeIds)
  if (excludeIds !== null && excludeIds.length > 0) {
    skusQ = skusQ.not('product_id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`)
  }

  const { data: skus, count, error: skusErr } = await skusQ.range(offset, offset + limit - 1)
  if (skusErr) throw new Error(`inventory skus: ${skusErr.message}`)
  if (!skus || skus.length === 0) return { data: [], total: count ?? 0 }

  const productIds = skus.map(s => s.product_id)

  // ── Steps 3‑5: Run in parallel — all take the same productIds, no inter-dependency ──
  let mapsQ = supabase
    .from('supplier_product_map')
    .select(`
      id,
      supplier_id,
      product_id,
      supplier_sku,
      supplier_brand_name,
      supplier_pattern_name,
      supplier_size_raw,
      supplier_price,
      supplier_stock,
      match_confidence,
      is_verified,
      suppliers ( supplier_name, connection_type )
    `)
    .in('product_id', productIds)
    .order('match_confidence', { ascending: false, nullsFirst: false })

  if (supplierId) mapsQ = mapsQ.eq('supplier_id', supplierId)

  let stockQ = supabase
    .from('supplier_product_stock')
    .select('supplier_id, product_id, available_stock, supplier_price, stock_last_updated')
    .in('product_id', productIds)

  if (supplierId) stockQ = stockQ.eq('supplier_id', supplierId)

  const [
    { data: maps,      error: mapsErr },
    { data: stocks                    },
    { data: ownStocks                 },
  ] = await Promise.all([
    mapsQ,
    stockQ,
    supabase
      .from('product_stock')
      .select('product_id, available_stock')
      .in('product_id', productIds),
  ])

  if (mapsErr) throw new Error(`inventory maps: ${mapsErr.message}`)

  // ── Step 6: Build lookups ─────────────────────────────────────────────────
  const mapsByProduct = new Map<string, typeof maps>()
  for (const m of (maps ?? [])) {
    if (!m.product_id) continue
    if (!mapsByProduct.has(m.product_id)) mapsByProduct.set(m.product_id, [])
    mapsByProduct.get(m.product_id)!.push(m)
  }

  const stockByKey = new Map<string, { available_stock: number; supplier_price: number | null }>()
  for (const s of (stocks ?? [])) {
    stockByKey.set(`${s.supplier_id}:${s.product_id}`, {
      available_stock: s.available_stock,
      supplier_price:  s.supplier_price,
    })
  }

  const ownStockByProduct = new Map<string, number>()
  for (const s of (ownStocks ?? [])) {
    ownStockByProduct.set(s.product_id, (ownStockByProduct.get(s.product_id) ?? 0) + (s.available_stock ?? 0))
  }

  // ── Step 7: Assemble ──────────────────────────────────────────────────────
  const rows: InventoryProductRow[] = skus.map(sku => {
    const rawMaps = mapsByProduct.get(sku.product_id) ?? []

    const supplierMappings: SupplierMappingEntry[] = rawMaps.map(m => {
      const sup    = m.suppliers as unknown as { supplier_name: string; connection_type: string } | null
      const synced = stockByKey.get(`${m.supplier_id}:${sku.product_id}`) ?? null
      const rowStatus = !m.is_verified ? 'pending_review' : synced ? 'synced' : 'mapped'

      return {
        map_id:                m.id,
        supplier_id:           m.supplier_id,
        supplier_name:         sup?.supplier_name    ?? 'Unknown',
        connection_type:       sup?.connection_type  ?? 'manual',
        supplier_sku:          m.supplier_sku,
        supplier_brand_name:   m.supplier_brand_name,
        supplier_pattern_name: m.supplier_pattern_name,
        supplier_size_raw:     m.supplier_size_raw,
        supplier_price:        m.supplier_price,
        supplier_stock:        m.supplier_stock,
        match_confidence:      m.match_confidence,
        is_verified:           m.is_verified,
        synced_price:          synced?.supplier_price   ?? null,
        synced_qty:            synced?.available_stock  ?? null,
        status:                rowStatus,
      }
    })

    return {
      product_id:        sku.product_id,
      sku:               sku.sku,
      tyre_size_display: sku.tyre_size_display,
      brand_name:        (sku.brands as unknown as { brand_name: string } | null)?.brand_name    ?? null,
      pattern_name:      (sku.patterns as unknown as { pattern_name: string } | null)?.pattern_name ?? null,
      own_stock:         ownStockByProduct.get(sku.product_id) ?? 0,
      supplier_mappings: supplierMappings,
    }
  })

  const result = { data: rows, total: count ?? 0 }
  inventoryCache.set(cacheKey, { data: result, exp: Date.now() + 60_000 })
  await redis?.set(cacheKey, result, { ex: 60 }).catch(() => null)
  return result
}

// Approve a mapping and enqueue stock sync
export async function approveInventoryMapping(mapId: string) {
  await bustInventoryCache()
  const { data, error } = await supabase
    .from('supplier_product_map')
    .update({ is_verified: true })
    .eq('id', mapId)
    .select('supplier_id, product_id')
    .single()

  if (error) throw new Error(`approve: ${error.message}`)

  if (data?.product_id && catalogueSyncQueue) {
    const job: CatalogueSyncJobData = {
      type:        'sync_supplier_stock',
      supplier_id: data.supplier_id,
      product_id:  data.product_id,
    }
    await catalogueSyncQueue.add('sync_supplier_stock', job, {
      jobId: `sync_stock:${data.supplier_id}:${data.product_id}`,
    })
  }
  return data
}

// Remove a mapping (also removes synced stock row)
export async function removeInventoryMapping(mapId: string) {
  await bustInventoryCache()
  const { data: row } = await supabase
    .from('supplier_product_map')
    .select('supplier_id, product_id')
    .eq('id', mapId)
    .maybeSingle()

  const { error } = await supabase.from('supplier_product_map').delete().eq('id', mapId)
  if (error) throw new Error(`remove: ${error.message}`)

  if (row?.supplier_id && row?.product_id) {
    await supabase
      .from('supplier_product_stock')
      .delete()
      .eq('supplier_id', row.supplier_id)
      .eq('product_id', row.product_id)
  }
}
