/**
 * Local type definitions for admin pages.
 * Replace with `import type { Database } from './database.types'` after
 * running: npx supabase gen types typescript --project-id <id>
 */

export interface Brand {
  brand_id: string
  brand_name: string
  brand_slug: string
  brand_logo: string | null
  brand_banner_image: string | null
  brand_description: string | null
  brand_short_description: string | null
  country_of_brand: string | null
  manufacturer_name: string | null
  brand_positioning: 'budget' | 'mid_range' | 'premium' | 'commercial' | null
  warranty_info: string | null
  seo_title: string | null
  seo_description: string | null
  is_active: boolean
  show_on_website: boolean
  channel_wholesale: boolean
  channel_retail: boolean
  channel_marketplaces: boolean
  created_at: string
  updated_at: string
}

export interface Collection {
  collection_id: string
  collection_name: string
}

export type CategoryType = 'season' | 'application' | 'performance' | 'position' | 'terrain'

export interface Category {
  category_id:          string
  category_name:        string
  category_slug:        string
  category_type:        CategoryType | string
  parent_category_id:   string | null
  description:          string | null
  image:                string | null
  sort_order:           number | null
  is_active:            boolean
  hidden_from_website:  boolean
  created_at:           string
}

export interface ProductStock {
  available_stock:     number
  low_stock_alert:     number | null
  last_stock_update:   string | null
}

export type PriceType = 'retail' | 'wholesale' | 'price_a' | 'price_b' | 'special' | 'clearance'

export interface ProductPrice {
  price_id:          string
  price_type:        PriceType
  price_inc_gst:     number
  price_ex_gst:      number
  start_date:        string | null
  end_date:          string | null
  is_active:         boolean
}

export interface Sku {
  product_id: string
  sku: string
  tyre_size_display: string
  status: string
  total_available_stock: number
  width: number | null
  profile: number | null
  rim_size: number | null
  speed_rating: string | null
  load_index: string | null
  fuel_rating: string | null
  wet_grip: string | null
  noise_db: string | null
  noise_class: string | null
  barcode_ean: string | null
  special_size: string | null
  lt_sizing: boolean
  runflat: boolean
  xl_reinforced: boolean
  ply_rating: string | null
  load_range: string | null
  construction_type: string | null
  load_speed_rating: string | null
  sidewall: string | null
  tube_type: string | null
  country_of_origin: string | null
  manufacturer_name: string | null
  factory_name: string | null
  factory_country: string | null
  section_width: number | null
  max_load: string | null
  max_pressure: string | null
  tread_depth: number | null
  tyre_weight: number | null
  overall_diameter: number | null
  e_mark: string | null
  dot_code: string | null
  utqg: string | null
  cost_price: number | null
  compare_at_price: number | null
  low_stock_alert: number | null
  variant_images: string[] | null
  replacement_product_id: string | null
  product_stock: ProductStock | null
  product_prices: ProductPrice[]
  patterns: PatternRef | null
}

export interface PatternRef {
  pattern_id: string
  pattern_name: string
  pattern_slug: string
  brands: { brand_name: string } | null
}

export interface Pattern {
  pattern_id:                string
  pattern_name:              string
  pattern_slug:              string
  brand_id:                  string | null
  collection_id:             string | null
  pattern_description:       string | null
  pattern_short_description: string | null
  main_image:                string | null
  gallery_images:            string[] | null
  tread_image:               string | null
  application_type:          'PCR' | '4x4' | 'TBR' | null
  season_type:               string | null
  performance_category:      string | null
  position_category:         string | null
  shoulder_type:             string | null
  terrain_type:              string | null
  default_country_of_origin: string | null
  warranty_km:               number | null
  seo_title:                 string | null
  seo_description:           string | null
  tyre_overview:             string | null
  features:                  string | null
  warranty_information:      string | null
  tyre_spec_sheet:           string | null
  faq_list:                  { question: string; answer: string }[] | null
  is_active:                 boolean
  show_on_website:           boolean
  on_sale:                   boolean
  discountable:              boolean
  tags:                      string[] | null
  updated_at:                string
  created_at:                string
  brands:            { brand_id: string; brand_name: string; brand_slug: string; brand_logo: string | null } | null
  collections:       { collection_id: string; collection_name: string } | null
  pattern_categories: { categories: { category_id: string; category_name: string; category_type?: string } | null }[]
}

export interface SkuListItem {
  product_id: string
  sku: string
  tyre_size_display: string
  status: string
  total_available_stock: number
  width: number | null
  profile: number | null
  rim_size: number | null
  speed_rating: string | null
  load_index: string | null
  product_stock: { available_stock: number; low_stock_alert: number | null } | null
}

export interface ProfileRow {
  role: 'super_admin' | 'customer'
}

// ── Orders ─────────────────────────────────────────────────────────────────

export type PaymentStatus = 'unpaid' | 'paid' | 'partially_paid' | 'refunded'
export type OrderStatus   = 'pending' | 'paid' | 'processing' | 'fulfilled' | 'cancelled' | 'refunded'

export interface OrderListItem {
  order_id:           string
  order_number:       string
  created_at:         string
  payment_status:     PaymentStatus
  order_status:       OrderStatus
  total_amount:       number
  currency:           string
  order_type:         string | null
  payment_method?:    string | null
  item_count?:        number
  shipping_address_snapshot: Record<string, string> | null
  customers:  { customer_id: string; first_name: string | null; last_name: string | null; email: string } | null
  order_items: { order_item_id: string }[]
}

export interface OrderItem {
  order_item_id: string
  product_id: string
  quantity: number
  unit_price: number
  skus: {
    sku: string
    tyre_size_display: string
  } | null
}

export interface OrderPayment {
  payment_id: string
  payment_reference: string | null
  payment_method: string
  amount: number
  currency: string
  status: string
  created_at: string
}

export interface OrderActivity {
  activity_id: string
  event_type: string
  description: string | null
  amount: number | null
  currency: string | null
  created_at: string
}

export interface OrderDetail {
  order_id:           string
  order_number:       string
  created_at:         string
  currency:           string
  notes:              string | null
  shipping_cost:      number
  gst_amount:         number
  discount_amount:    number
  total_amount:       number
  payment_status:     PaymentStatus
  order_status:       OrderStatus
  order_type:         string | null
  shipping_address_id: string | null
  shipping_address_snapshot: Record<string, string> | null
  billing_address_snapshot:  Record<string, string> | null
  customers: {
    customer_id: string
    email:       string
    first_name:  string | null
    last_name:   string | null
    phone:       string | null
    created_at:  string
    profile_id:  string | null
  } | null
  order_items:     OrderItem[]
  order_payments:  OrderPayment[]
  order_activity:  OrderActivity[]
}

// ── Customer Management ────────────────────────────────────────────────────

export type AccountType = 'guest' | 'registered'

export interface CustomerListItem {
  customer_id:        string
  email:              string
  first_name:         string | null
  last_name:          string | null
  phone:              string | null
  created_at:         string
  profile_id:         string | null  // null = Guest, set = Registered
  order_count?:       number
  total_spent?:       number
  last_order_number?: string | null
  last_order_date?:   string | null
}

export type AddressOwnerType = 'customer'

export interface Address {
  address_id:     string
  // Polymorphic owner fields (spec)
  owner_type:     AddressOwnerType | null
  owner_id:       string | null
  address_name:   string
  // Spec column names
  address_line_1: string
  address_line_2: string | null
  suburb:         string | null
  postcode:       string | null
  state:          string | null
  country:        string | null
  is_default:     boolean
  latitude:       number | null
  longitude:      number | null
  phone:          string | null
  // Legacy field names (backward compat — still returned by DB)
  customer_id?:   string
  address_line1?: string
  address_line2?: string | null
  city?:          string | null
  postal_code?:   string | null
  company?:       string | null
}

export interface CustomerDetail extends CustomerListItem {
  orders:    OrderListItem[]
  addresses: Address[]
}
