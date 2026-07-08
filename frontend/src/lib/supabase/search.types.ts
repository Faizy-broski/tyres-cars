export interface TyreSku {
  product_id:        string
  sku:               string
  product_slug:      string | null
  tyre_size_display: string
  brand_id:          string
  brand_name:        string
  brand_slug:        string
  brand_logo:        string | null
  brand_positioning: 'budget' | 'mid_range' | 'premium' | 'commercial' | null
  pattern_id:        string
  pattern_name:      string
  pattern_slug:      string
  main_image:        string | null
  width:             number
  profile:           number
  rim_size:          number
  speed_rating:      string | null
  runflat:           boolean
  xl_reinforced:     boolean
  total_stock:       number
  price_inc_gst:     number | null
  promo_price:       number | null  // best active promotion price; null = no deal
}

export interface TyreFacets {
  widths:      number[]
  profiles:    number[]
  rim_sizes:   number[]
  brands:      { brand_id: string; brand_name: string; brand_slug: string }[]
  price_range: { min: number | null; max: number | null }
}

export interface TyreSearchFilters {
  q?:          string
  width?:      number
  profile?:    number
  rim_size?:   number
  brand_id?:   string
  runflat?:    boolean
  xl?:         boolean
  speed?:      string
  app_type?:   string  // 'PCR' | '4x4' | 'TBR'
  price_min?:  number
  price_max?:  number
  sort?:       'price_asc' | 'price_desc' | 'stock_desc' | 'updated_at_desc'
  page?:       number
}

export const PAGE_SIZE = 24
