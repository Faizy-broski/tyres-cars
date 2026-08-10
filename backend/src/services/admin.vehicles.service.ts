import { supabase } from './supabase.service'
import { redis } from './redis.service'

// ============================================================
// Types
// ============================================================

export type VehiclePayload = {
  make:       string
  model:      string
  year_from:  number
  year_to?:   number | null
  series?:    string | null
  variant?:   string | null
  body_type?: string | null
}

export type TyreFitmentPayload = {
  front_size:   string
  rear_size?:   string | null
  is_staggered: boolean
  notes?:       string | null
}

export type WheelFitmentPayload = {
  pcd:            string
  diameter_range?: string | null
  width_range?:   string | null
  offset_min?:    number | null
  offset_max?:    number | null
  centre_bore?:   number | null
  notes?:         string | null
}

export type VehicleListFilters = {
  search?:  string
  make?:    string
  model?:   string
  page?:    number
  limit?:   number
}

// Bust the storefront fitment caches when fitments change
async function bustFitmentCache(vehicleId: string) {
  await Promise.all([
    redis?.del(`fitment:${vehicleId}`),
    redis?.del(`wheel-fitment:${vehicleId}`),
  ])
}

// ============================================================
// VEHICLES
// ============================================================

export async function listVehicles(filters: VehicleListFilters = {}) {
  const { search = '', make = '', model = '', page = 1, limit = 50 } = filters
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let query = supabase
    .from('vehicles')
    .select('vehicle_id, make, model, year_from, year_to, series, variant, body_type, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (make)   query = query.eq('make', make)
  if (model)  query = query.eq('model', model)
  if (search) query = query.or(`make.ilike.%${search}%,model.ilike.%${search}%,variant.ilike.%${search}%,series.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], total: count ?? 0, page, limit }
}

export async function getVehicle(vehicleId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      vehicle_id, make, model, year_from, year_to, series, variant, body_type, created_at,
      vehicle_tyre_fitments ( fitment_id, front_size, rear_size, is_staggered, notes ),
      vehicle_wheel_fitments ( fitment_id, pcd, diameter_range, width_range, offset_min, offset_max, centre_bore, notes )
    `)
    .eq('vehicle_id', vehicleId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // no matching row — let the controller 404
    throw error
  }
  return data
}

export async function createVehicle(payload: VehiclePayload) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      make:      payload.make,
      model:     payload.model,
      year_from: payload.year_from,
      year_to:   payload.year_to   ?? null,
      series:    payload.series    ?? null,
      variant:   payload.variant   ?? null,
      body_type: payload.body_type ?? null,
    })
    .select('vehicle_id, make, model, year_from, year_to, series, variant, body_type, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateVehicle(vehicleId: string, payload: Partial<VehiclePayload>) {
  const allowed: Record<string, unknown> = {}
  if (payload.make      !== undefined) allowed.make      = payload.make
  if (payload.model     !== undefined) allowed.model     = payload.model
  if (payload.year_from !== undefined) allowed.year_from = payload.year_from
  if (payload.year_to   !== undefined) allowed.year_to   = payload.year_to
  if (payload.series    !== undefined) allowed.series    = payload.series
  if (payload.variant   !== undefined) allowed.variant   = payload.variant
  if (payload.body_type !== undefined) allowed.body_type = payload.body_type
  const { error } = await supabase.from('vehicles').update(allowed).eq('vehicle_id', vehicleId)
  if (error) throw error
}

export async function deleteVehicle(vehicleId: string) {
  const { error } = await supabase.from('vehicles').delete().eq('vehicle_id', vehicleId)
  if (error) throw error
  await bustFitmentCache(vehicleId)
}

// ============================================================
// VEHICLE TYRE FITMENTS
// ============================================================

export async function addTyreFitment(vehicleId: string, payload: TyreFitmentPayload) {
  const { data, error } = await supabase
    .from('vehicle_tyre_fitments')
    .insert({
      vehicle_id:   vehicleId,
      front_size:   payload.front_size,
      rear_size:    payload.rear_size    ?? null,
      is_staggered: payload.is_staggered,
      notes:        payload.notes        ?? null,
    })
    .select('fitment_id, vehicle_id, front_size, rear_size, is_staggered, notes')
    .single()
  if (error) throw error
  await bustFitmentCache(vehicleId)
  return data
}

export async function updateTyreFitment(fitmentId: string, vehicleId: string, payload: Partial<TyreFitmentPayload>) {
  const allowed: Record<string, unknown> = {}
  if (payload.front_size   !== undefined) allowed.front_size   = payload.front_size
  if (payload.rear_size    !== undefined) allowed.rear_size    = payload.rear_size
  if (payload.is_staggered !== undefined) allowed.is_staggered = payload.is_staggered
  if (payload.notes        !== undefined) allowed.notes        = payload.notes
  const { error } = await supabase.from('vehicle_tyre_fitments').update(allowed).eq('fitment_id', fitmentId)
  if (error) throw error
  await bustFitmentCache(vehicleId)
}

export async function deleteTyreFitment(fitmentId: string, vehicleId: string) {
  const { error } = await supabase.from('vehicle_tyre_fitments').delete().eq('fitment_id', fitmentId)
  if (error) throw error
  await bustFitmentCache(vehicleId)
}

// ============================================================
// VEHICLE WHEEL FITMENTS
// ============================================================

export async function addWheelFitment(vehicleId: string, payload: WheelFitmentPayload) {
  const { data, error } = await supabase
    .from('vehicle_wheel_fitments')
    .insert({
      vehicle_id:     vehicleId,
      pcd:            payload.pcd,
      diameter_range: payload.diameter_range ?? null,
      width_range:    payload.width_range    ?? null,
      offset_min:     payload.offset_min     ?? null,
      offset_max:     payload.offset_max     ?? null,
      centre_bore:    payload.centre_bore    ?? null,
      notes:          payload.notes          ?? null,
    })
    .select('fitment_id, vehicle_id, pcd, diameter_range, width_range, offset_min, offset_max, centre_bore, notes')
    .single()
  if (error) throw error
  await bustFitmentCache(vehicleId)
  return data
}

export async function updateWheelFitment(fitmentId: string, vehicleId: string, payload: Partial<WheelFitmentPayload>) {
  const allowed: Record<string, unknown> = {}
  if (payload.pcd            !== undefined) allowed.pcd            = payload.pcd
  if (payload.diameter_range !== undefined) allowed.diameter_range = payload.diameter_range
  if (payload.width_range    !== undefined) allowed.width_range    = payload.width_range
  if (payload.offset_min     !== undefined) allowed.offset_min     = payload.offset_min
  if (payload.offset_max     !== undefined) allowed.offset_max     = payload.offset_max
  if (payload.centre_bore    !== undefined) allowed.centre_bore    = payload.centre_bore
  if (payload.notes          !== undefined) allowed.notes          = payload.notes
  const { error } = await supabase.from('vehicle_wheel_fitments').update(allowed).eq('fitment_id', fitmentId)
  if (error) throw error
  await bustFitmentCache(vehicleId)
}

export async function deleteWheelFitment(fitmentId: string, vehicleId: string) {
  const { error } = await supabase.from('vehicle_wheel_fitments').delete().eq('fitment_id', fitmentId)
  if (error) throw error
  await bustFitmentCache(vehicleId)
}

// ============================================================
// Helpers for dropdowns
// ============================================================

// Vehicle makes/models are near-static — cache them in process memory for 1 hour
// so we never full-scan the 5 500+ row vehicles table on every dropdown render.
const vehicleDropdownCache = new Map<string, { data: string[]; exp: number }>()

export async function listVehicleMakes() {
  const key = 'makes'
  const hit = vehicleDropdownCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.data

  const { data } = await supabase.from('vehicles').select('make').order('make')
  const makes = [...new Set((data ?? []).map(r => r.make))].sort()
  vehicleDropdownCache.set(key, { data: makes, exp: Date.now() + 3_600_000 })
  return makes
}

export async function listVehicleModels(make: string) {
  const key = `models:${make}`
  const hit = vehicleDropdownCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.data

  const { data } = await supabase.from('vehicles').select('model').eq('make', make).order('model')
  const models = [...new Set((data ?? []).map(r => r.model))].sort()
  vehicleDropdownCache.set(key, { data: models, exp: Date.now() + 3_600_000 })
  return models
}
