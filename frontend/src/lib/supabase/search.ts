import { createClient } from '@/lib/supabase/server'
import type { TyreSku, TyreFacets, TyreSearchFilters } from './search.types'

export async function searchTyres(
  filters: TyreSearchFilters,
): Promise<{ data: TyreSku[]; total: number }> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('search_tyres', {
    p_q:        filters.q        ?? null,
    p_width:    filters.width    ?? null,
    p_profile:  filters.profile  ?? null,
    p_rim_size: filters.rim_size ?? null,
    p_brand_id: filters.brand_id ?? null,
    p_runflat:   filters.runflat   ?? null,
    p_xl:        filters.xl        ?? null,
    p_speed:     filters.speed     ?? null,
    p_app_type:  filters.app_type  ?? null,
    p_price_min: filters.price_min ?? null,
    p_price_max: filters.price_max ?? null,
    p_sort:      filters.sort      ?? 'updated_at_desc',
    p_page:     filters.page     ?? 1,
    p_limit:    24,
  })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as (TyreSku & { total_count: number })[]
  const total = rows[0]?.total_count ?? 0

  return { data: rows, total: Number(total) }
}

export async function getTyreFacets(
  filters: Pick<TyreSearchFilters, 'width' | 'profile' | 'rim_size' | 'brand_id'>,
): Promise<TyreFacets> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_tyre_facets', {
    p_width:    filters.width    ?? null,
    p_profile:  filters.profile  ?? null,
    p_rim_size: filters.rim_size ?? null,
    p_brand_id: filters.brand_id ?? null,
  })

  if (error) throw new Error(error.message)

  return (data ?? { widths: [], profiles: [], rim_sizes: [], brands: [], price_range: { min: null, max: null } }) as TyreFacets
}
