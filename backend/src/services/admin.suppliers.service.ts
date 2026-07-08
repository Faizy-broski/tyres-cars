import { supabase } from './supabase.service'
import { supplierImportQueue, catalogueSyncQueue } from '../queues'
import type { SupplierImportJobData } from '../workers/supplier-import.worker'
import type { CatalogueSyncJobData } from '../workers/catalogue-sync.worker'

// ============================================================
// Types
// ============================================================
export type SupplierRow = {
  supplier_sku?: string
  supplier_product_name?: string
  supplier_brand_name?: string
  supplier_pattern_name?: string
  supplier_size_raw?: string
  load_index?: string
  speed_rating?: string
  ply_rating?: string
  supplier_price?: number
  supplier_stock?: number
  lead_time_days?: number
}

export type CreateSupplierPayload = {
  supplier_name:      string
  supplier_type?:     'factory' | 'wholesaler' | 'marketplace_partner' | '3pl'
  connection_type?:   'api_link' | 'edi' | 'csv' | 'manual'
  contact_name?:      string
  contact_email?:     string
  contact_phone?:     string
  state?:             string
  country?:           string
  payment_terms?:     string
  stock_access_type?: 'owned_after_purchase' | 'consignment' | 'live_supplier_stock'
  api_connected?:     boolean
  is_active?:         boolean
}

export type MappingFilter  = 'pending' | 'verified' | 'all'
export type MappingViewFilter = 'all' | 'mapped' | 'pending' | 'unmatched'
export type MappingStatus = 'mapped_synced' | 'mapped' | 'pending_review' | 'unmatched'

export type MappingParams = {
  size:             number  // weight 0-100
  brand:            number
  pattern:          number
  load_speed:       number
  auto_threshold:   number  // confidence threshold 0-100
  review_threshold: number
}

export const DEFAULT_MAPPING_PARAMS: MappingParams = {
  size: 50, brand: 20, pattern: 20, load_speed: 10,
  auto_threshold: 90, review_threshold: 70,
}

const ALLOWED_SUPPLIER_FIELDS = new Set([
  'supplier_name', 'supplier_type', 'connection_type', 'contact_name', 'contact_email',
  'contact_phone', 'state', 'country', 'payment_terms', 'stock_access_type', 'api_connected', 'is_active',
])

// ============================================================
// LIST
// ============================================================
export async function listSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('supplier_id, supplier_name, supplier_type, connection_type, contact_name, contact_email, contact_phone, state, country, payment_terms, stock_access_type, api_connected, is_active, created_at, updated_at')
    .order('supplier_name')
    .limit(200)

  if (error) throw error
  return data ?? []
}

// ============================================================
// GET SINGLE — with mapping stats
// ============================================================
export async function getSupplier(id: string) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('supplier_id', id)
    .single()

  if (error) throw error

  // Mapping counts
  const [{ count: autoMapped }, { count: pendingReview }] = await Promise.all([
    supabase.from('supplier_product_map')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id)
      .eq('is_verified', true),
    supabase.from('supplier_product_map')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id)
      .eq('is_verified', false),
  ])

  return { ...data, stats: { auto_mapped: autoMapped ?? 0, pending_review: pendingReview ?? 0 } }
}

// ============================================================
// CREATE
// ============================================================
export async function createSupplier(payload: CreateSupplierPayload) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      supplier_name:     payload.supplier_name,
      supplier_type:     payload.supplier_type ?? 'wholesaler',
      connection_type:   payload.connection_type ?? 'manual',
      contact_name:      payload.contact_name ?? null,
      contact_email:     payload.contact_email ?? null,
      contact_phone:     payload.contact_phone ?? null,
      state:             payload.state ?? null,
      country:           payload.country ?? 'Australia',
      payment_terms:     payload.payment_terms ?? null,
      stock_access_type: payload.stock_access_type ?? 'owned_after_purchase',
      api_connected:     payload.api_connected ?? false,
      is_active:         payload.is_active ?? true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSupplier(id: string) {
  // purchase_orders.supplier_id is ON DELETE RESTRICT (NOT NULL) — check before attempting
  const { count, error: checkError } = await supabase
    .from('purchase_orders')
    .select('po_id', { count: 'exact', head: true })
    .eq('supplier_id', id)

  if (checkError) throw checkError

  if ((count ?? 0) > 0) {
    const err = new Error(
      'Cannot delete supplier: there are existing purchase orders linked to this supplier. ' +
      'Remove or reassign the purchase orders first.'
    )
    ;(err as NodeJS.ErrnoException).code = 'SUPPLIER_HAS_PURCHASE_ORDERS'
    throw err
  }

  const { error } = await supabase.from('suppliers').delete().eq('supplier_id', id)
  if (error) throw error
}

// ============================================================
// UPDATE
// ============================================================
export async function updateSupplier(id: string, body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_SUPPLIER_FIELDS.has(k)) patch[k] = v
  }

  const { error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('supplier_id', id)

  if (error) throw error
}

// ============================================================
// GET MAPPINGS — for review dashboard
// ============================================================
export async function getSupplierMappings(
  supplierId: string,
  { page = 1, filter = 'pending' as MappingFilter, limit = 30 } = {}
) {
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let query = supabase
    .from('supplier_product_map')
    .select(`
      id,
      supplier_sku,
      supplier_brand_name,
      supplier_pattern_name,
      supplier_size_raw,
      normalized_size_code,
      load_index,
      speed_rating,
      supplier_price,
      supplier_stock,
      match_confidence,
      is_verified,
      last_updated,
      created_at,
      product_id,
      skus:product_id (
        sku,
        tyre_size_display,
        brands:brand_id ( brand_name ),
        patterns:pattern_id ( pattern_name )
      )
    `, { count: 'exact' })
    .eq('supplier_id', supplierId)
    .order('match_confidence', { ascending: false })
    .range(from, to)

  if (filter === 'pending')  query = query.eq('is_verified', false).not('product_id', 'is', null)
  if (filter === 'verified') query = query.eq('is_verified', true)

  const { data, count, error } = await query
  if (error) throw error

  return { data: data ?? [], total: count ?? 0 }
}

// ============================================================
// APPROVE — set is_verified = true, then enqueue stock sync
// ============================================================
export async function approveMapping(mapId: string) {
  const { data, error } = await supabase
    .from('supplier_product_map')
    .update({ is_verified: true })
    .eq('id', mapId)
    .select('supplier_id, product_id')
    .single()

  if (error) throw error
  if (data?.product_id) await enqueueSyncJob(data.supplier_id, data.product_id)
}

// ============================================================
// REJECT — delete the row
// ============================================================
export async function rejectMapping(mapId: string) {
  const { error } = await supabase
    .from('supplier_product_map')
    .delete()
    .eq('id', mapId)

  if (error) throw error
}

// ============================================================
// MANUAL MAP — admin picks the correct product, auto-approve + sync
// ============================================================
export async function manualMap(mapId: string, productId: string) {
  const { data, error } = await supabase
    .from('supplier_product_map')
    .update({ product_id: productId, is_verified: true })
    .eq('id', mapId)
    .select('supplier_id')
    .single()

  if (error) throw error
  if (data?.supplier_id) await enqueueSyncJob(data.supplier_id, productId)
}

// ============================================================
// APPROVE ALL PENDING — bulk verify + bulk enqueue sync
// ============================================================
export async function approveAllPending(supplierId: string) {
  const { data: pending, error: fetchErr } = await supabase
    .from('supplier_product_map')
    .select('id, product_id')
    .eq('supplier_id', supplierId)
    .eq('is_verified', false)
    .not('product_id', 'is', null)

  if (fetchErr) throw fetchErr
  if (!pending || pending.length === 0) return { count: 0 }

  const ids = pending.map(p => p.id)
  const { error: updateErr } = await supabase
    .from('supplier_product_map')
    .update({ is_verified: true })
    .in('id', ids)

  if (updateErr) throw updateErr

  // Fire sync jobs in parallel (catalogueSyncQueue handles concurrency internally)
  await Promise.all(
    pending.map(row => row.product_id ? enqueueSyncJob(supplierId, row.product_id) : Promise.resolve())
  )

  return { count: pending.length }
}

// ============================================================
// GET MAPPING VIEW — split-panel data for the mapping interface
// Avoids FK join syntax — does explicit separate lookups instead
// ============================================================
export async function getMappingView(
  supplierId: string,
  options: { page?: number; filter?: MappingViewFilter; limit?: number; q?: string } = {}
) {
  const { page = 1, filter = 'all', limit = 25, q = '' } = options
  const offset = (page - 1) * limit
  const search = q.trim()

  // 1. Count — flat table, no joins
  let cq = supabase
    .from('supplier_product_map')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
  if (filter === 'mapped')    cq = cq.eq('is_verified', true)
  if (filter === 'pending')   cq = cq.eq('is_verified', false).not('product_id', 'is', null)
  if (filter === 'unmatched') cq = cq.is('product_id', null)
  if (search)                 cq = cq.or(`supplier_size_raw.ilike.%${search}%,supplier_brand_name.ilike.%${search}%,supplier_pattern_name.ilike.%${search}%,supplier_sku.ilike.%${search}%`)

  const { count, error: countErr } = await cq
  if (countErr) throw new Error(`mapping-view count: ${countErr.message}`)

  // 2. Flat map rows — no nested join, avoids PostgREST FK ambiguity
  let dq = supabase
    .from('supplier_product_map')
    .select(`
      id,
      supplier_id,
      supplier_sku,
      supplier_brand_name,
      supplier_pattern_name,
      supplier_size_raw,
      normalized_size_code,
      load_index,
      speed_rating,
      supplier_price,
      supplier_stock,
      lead_time_days,
      match_confidence,
      is_verified,
      last_updated,
      created_at,
      product_id
    `)
    .eq('supplier_id', supplierId)
    .order('match_confidence', { ascending: false, nullsFirst: false })
  if (filter === 'mapped')    dq = dq.eq('is_verified', true)
  if (filter === 'pending')   dq = dq.eq('is_verified', false).not('product_id', 'is', null)
  if (filter === 'unmatched') dq = dq.is('product_id', null)
  if (search)                 dq = dq.or(`supplier_size_raw.ilike.%${search}%,supplier_brand_name.ilike.%${search}%,supplier_pattern_name.ilike.%${search}%,supplier_sku.ilike.%${search}%`)

  const { data: maps, error: mapsErr } = await dq.range(offset, offset + limit - 1)
  if (mapsErr) throw new Error(`mapping-view data: ${mapsErr.message}`)

  // 3. Fetch SKU info for any matched product_ids
  const productIds = [...new Set((maps ?? []).map(m => m.product_id).filter(Boolean))] as string[]

  type SkuRow = { product_id: string; sku: string; tyre_size_display: string; brand_name: string | null; pattern_name: string | null }
  let skuLookup = new Map<string, SkuRow>()

  if (productIds.length > 0) {
    const { data: skus, error: skusErr } = await supabase
      .from('skus')
      .select(`
        product_id,
        sku,
        tyre_size_display,
        brands ( brand_name ),
        patterns ( pattern_name )
      `)
      .in('product_id', productIds)

    if (skusErr) throw new Error(`mapping-view skus: ${skusErr.message}`)

    for (const s of (skus ?? [])) {
      skuLookup.set(s.product_id, {
        product_id:        s.product_id,
        sku:               s.sku,
        tyre_size_display: s.tyre_size_display,
        brand_name:        (s.brands as any)?.brand_name ?? null,
        pattern_name:      (s.patterns as any)?.pattern_name ?? null,
      })
    }
  }

  // 4. Synced stock lookup
  const { data: stocks, error: stocksErr } = await supabase
    .from('supplier_product_stock')
    .select('product_id, available_stock, supplier_price, stock_last_updated')
    .eq('supplier_id', supplierId)

  if (stocksErr) throw new Error(`mapping-view stocks: ${stocksErr.message}`)

  const stockLookup = new Map((stocks ?? []).map(s => [s.product_id, s]))

  // 5. Assemble rows
  const rows = (maps ?? []).map(m => {
    const skuRow = m.product_id ? (skuLookup.get(m.product_id) ?? null) : null
    const synced = m.product_id ? (stockLookup.get(m.product_id) ?? null) : null

    let status: MappingStatus
    if (!m.product_id)       status = 'unmatched'
    else if (!m.is_verified) status = 'pending_review'
    else if (synced)         status = 'mapped_synced'
    else                     status = 'mapped'

    return {
      ...m,
      skus:        skuRow ? {
        sku:               skuRow.sku,
        tyre_size_display: skuRow.tyre_size_display,
        brands:            skuRow.brand_name   ? { brand_name:   skuRow.brand_name   } : null,
        patterns:          skuRow.pattern_name ? { pattern_name: skuRow.pattern_name } : null,
      } : null,
      synced_stock: synced,
      status,
    }
  })

  return { data: rows, total: count ?? 0 }
}

// ============================================================
// Internal helper — enqueue a catalogue sync job
// ============================================================
async function enqueueSyncJob(supplier_id: string, product_id: string) {
  if (!catalogueSyncQueue) return
  const jobData: CatalogueSyncJobData = { type: 'sync_supplier_stock', supplier_id, product_id }
  await catalogueSyncQueue.add('sync_supplier_stock', jobData, {
    jobId: `sync_stock:${supplier_id}:${product_id}`,
    // Deduplicated by jobId — re-approving same mapping won't double-queue
  })
}

// ============================================================
// SUPPLIER PRODUCT STOCK — manage per-SKU stock entries
// ============================================================

export async function listSupplierStock(supplierId: string) {
  const { data, error } = await supabase
    .from('supplier_product_stock')
    .select(`
      id,
      supplier_id,
      product_id,
      warehouse_id,
      available_stock,
      supplier_price,
      selling_allowed,
      lead_time_days,
      stock_last_updated,
      created_at,
      skus ( sku, tyre_size_display )
    `)
    .eq('supplier_id', supplierId)
    .order('stock_last_updated', { ascending: false, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export async function upsertSupplierStock(payload: {
  supplier_id:      string
  product_id:       string
  warehouse_id?:    string | null
  available_stock:  number
  supplier_price?:  number | null
  selling_allowed?: boolean
  lead_time_days?:  number | null
}) {
  const { data, error } = await supabase
    .from('supplier_product_stock')
    .upsert(
      {
        supplier_id:        payload.supplier_id,
        product_id:         payload.product_id,
        warehouse_id:       payload.warehouse_id   ?? null,
        available_stock:    payload.available_stock,
        supplier_price:     payload.supplier_price ?? null,
        selling_allowed:    payload.selling_allowed ?? true,
        lead_time_days:     payload.lead_time_days  ?? null,
        stock_last_updated: new Date().toISOString(),
      },
      { onConflict: 'supplier_id,product_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSupplierStock(stockId: string) {
  const { error } = await supabase
    .from('supplier_product_stock')
    .delete()
    .eq('id', stockId)

  if (error) throw error
}

// ============================================================
// ENQUEUE CSV IMPORT
// ============================================================
export async function enqueueImport(supplierId: string, rows: SupplierRow[], sessionId: string) {
  if (!supplierImportQueue) {
    throw new Error('BullMQ not configured — set UPSTASH_REDIS_URL')
  }

  const jobData: SupplierImportJobData = {
    supplier_id:       supplierId,
    rows,
    import_session_id: sessionId,
  }

  const job = await supplierImportQueue.add('import', jobData, {
    jobId: `import:${supplierId}:${sessionId}`,
  })

  return job.id
}

// ============================================================
// GET IMPORT JOB STATUS
// ============================================================
export async function getImportJobStatus(jobId: string) {
  if (!supplierImportQueue) {
    return { state: 'unknown', progress: 0 }
  }

  const job = await supplierImportQueue.getJob(jobId)
  if (!job) return { state: 'not_found', progress: 0 }

  const state    = await job.getState()
  const progress = typeof job.progress === 'number' ? job.progress : 0

  return {
    state,
    progress,
    result:    state === 'completed' ? job.returnvalue : null,
    failReason: state === 'failed'   ? job.failedReason : null,
  }
}
