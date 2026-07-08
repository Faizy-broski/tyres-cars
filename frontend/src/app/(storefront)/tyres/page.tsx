import { searchTyres, getTyreFacets } from '@/lib/supabase/search'
import TyresListingClient from '@/components/storefront/TyresListingClient'

export const metadata = {
  title: 'Shop Tyres',
  description: 'Browse our full range of tyres. Filter by size, brand, and more.',
}

interface Props {
  searchParams: Promise<{
    q?:        string
    width?:    string
    profile?:  string
    rim_size?: string
    brand_id?: string
    runflat?:  string
    xl?:       string
    speed?:    string
    app_type?: string
    price_min?: string
    price_max?: string
    page?:     string
    sort?:     string
  }>
}

export default async function TyresPage({ searchParams }: Props) {
  const params = await searchParams

  const filters = {
    q:        params.q,
    width:    params.width    ? Number(params.width)    : undefined,
    profile:  params.profile  ? Number(params.profile)  : undefined,
    rim_size: params.rim_size ? Number(params.rim_size) : undefined,
    brand_id: params.brand_id,
    runflat:  params.runflat === 'true' ? true : params.runflat === 'false' ? false : undefined,
    xl:       params.xl      === 'true' ? true : params.xl      === 'false' ? false : undefined,
    speed:    params.speed,
    app_type: params.app_type,
    price_min: params.price_min ? Number(params.price_min) : undefined,
    price_max: params.price_max ? Number(params.price_max) : undefined,
    sort:     params.sort as 'price_asc' | 'price_desc' | 'stock_desc' | 'updated_at_desc' | undefined,
    page:     params.page ? Number(params.page) : 1,
  }

  let result = null
  let facets = null
  let errorMsg: string | null = null

  try {
    ;[result, facets] = await Promise.all([
      searchTyres(filters),
      // Facets intentionally don't take price_min/price_max — a min/max range
      // facet shouldn't exclude itself the way width/profile/rim/brand do.
      getTyreFacets({
        width:    filters.width,
        profile:  filters.profile,
        rim_size: filters.rim_size,
        brand_id: filters.brand_id,
      }),
    ])
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Search unavailable'
  }

  return (
    <TyresListingClient
      initialResult={result}
      initialFacets={facets}
      initialError={errorMsg}
      initialParams={{
        q:        params.q ?? '',
        width:    filters.width,
        profile:  filters.profile,
        rim_size: filters.rim_size,
        brand_id: params.brand_id,
        runflat:  filters.runflat,
        xl:       filters.xl,
        speed:    params.speed,
        app_type: params.app_type,
        price_min: filters.price_min,
        price_max: filters.price_max,
        sort:     (params.sort ?? 'updated_at_desc') as 'price_asc' | 'price_desc' | 'stock_desc' | 'updated_at_desc',
        page:     filters.page,
      }}
    />
  )
}

