import { z } from 'zod'

// react-hook-form's valueAsNumber returns NaN for empty inputs.
// These helpers coerce NaN to undefined / a default so Zod doesn't reject optional fields.
const optNum = z.preprocess(
  (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
  z.number().optional()
)
const numWithDefault = (def: number) =>
  z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? def : v),
    z.number().min(0).default(def)
  )

// ── Variant row ────────────────────────────────────────────────────────────
export const variantSchema = z.object({
  sku:             z.string().min(1, 'SKU is required'),
  barcodeEan:      z.string().optional(),
  tyreSizeDisplay: z.string().min(1, 'Tyre size is required'),
  width:           optNum,
  profile:         optNum,
  rimSize:         z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
    z.number({ message: 'Rim size is required' })
  ),
  specialSize:     z.string().optional(),
  constructionType:  z.string().optional(),
  speedRating:      z.string().optional(),
  loadIndex:        z.string().optional(),
  loadSpeedRating:  z.string().optional(),
  fuelRating:      z.string().optional(),
  wetGrip:         z.string().optional(),
  noiseDb:         z.string().optional(),
  noiseClass:      z.string().optional(),
  runflat:         z.boolean().default(false),
  xlReinforced:    z.boolean().default(false),
  ltSizing:        z.boolean().default(false),
  plyRating:       z.string().optional(),
  loadRange:       z.string().optional(),
  sidewall:        z.preprocess(v => v === '' ? undefined : v, z.enum(['BSW', 'OWL', 'RWL', 'WSW']).optional()),
  tubeType:        z.preprocess(v => v === '' ? undefined : v, z.enum(['tubeless', 'tube_type']).optional()),
  manufacturerName: z.string().optional(),
  countryOfOrigin:  z.string().optional(),
  factoryName:      z.string().optional(),
  factoryCountry:   z.string().optional(),
  // Physical specs
  sectionWidth:    optNum,
  treadDepth:      optNum,
  tyreWeight:      optNum,
  overallDiameter: optNum,
  maxLoad:         z.string().optional(),
  maxPressure:     z.string().optional(),
  // Compliance codes
  eMark:           z.string().optional(),
  dotCode:         z.string().optional(),
  utqg:            z.string().optional(),
  variantImages:   z.array(z.string()).default([]),
  // SKU lifecycle
  status:               z.enum(['active', 'inactive', 'discontinued']).default('active'),
  replacementProductId: z.string().optional(),
})

// ── Pricing row (parallel to variant, same index) ─────────────────────────
export const pricingSchema = z.object({
  priceIncGst:   z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
    z.number({ message: 'Price is required' }).min(0)
  ),
  compareAtPrice: optNum,
  costPrice:     optNum,
  inventory:     numWithDefault(0),
  lowStockAlert: numWithDefault(10),
})

// ── FAQ item ───────────────────────────────────────────────────────────────
export const faqItemSchema = z.object({
  question: z.string(),
  answer:   z.string(),
})

// ── Full product form ──────────────────────────────────────────────────────
export const createProductSchema = z.object({
  // Tab 1: Basic Info
  brandId:           z.string().min(1, 'Brand is required'),
  patternName:       z.string().min(1, 'Title is required'),
  patternSlug:       z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  shortDescription:  z.string().optional(),
  galleryImages:     z.array(z.string()).default([]),
  tyreOverview:      z.string().optional(),
  features:          z.string().optional(),
  warrantyInformation: z.string().optional(),
  tyreSpecSheet:     z.string().optional(),
  faqList:           z.array(faqItemSchema).default([]),

  // Tab 1 extra: SEO + visibility + default country fallback
  defaultCountryOfOrigin: z.string().optional(),
  isActive:          z.boolean().default(true),
  showOnWebsite:     z.boolean().default(false),
  seoTitle:          z.string().optional(),
  seoDescription:    z.string().optional(),
  treadImage:        z.string().optional(),

  // Tab 2: Categories
  discountable:       z.boolean().default(true),
  applicationType:    z.enum(['PCR', '4x4', 'TBR']).default('PCR'),
  categoryIds:        z.array(z.string()).default([]),
  performanceCategory: z.string().transform(v => v || undefined).optional(),
  seasonType:         z.string().transform(v => v || undefined).optional(),
  collectionId:       z.string().transform(v => v || undefined).optional(),
  tags:               z.array(z.string()).default([]),
  positionCategory:   z.enum(['steer', 'drive', 'trailer', 'all_position']).optional(),
  shoulderType:       z.enum(['open_shoulder', 'closed_shoulder', 'block_drive']).optional(),
  terrainType:        z.string().optional(),
  warrantyKm:         optNum,

  // Tab 3: Variants (UI hidden — variants disabled; schema kept intact for future re-enable)
  variants: z.array(variantSchema).default([]),

  // Tab 4: Pricing & Inventory (parallel array)
  pricing: z.array(pricingSchema).default([]),
})

export type CreateProductFormValues = z.infer<typeof createProductSchema>
export type VariantFormValues      = z.infer<typeof variantSchema>
export type PricingFormValues      = z.infer<typeof pricingSchema>
export type FaqItem                = z.infer<typeof faqItemSchema>

// ── Edit product schema — same as create but variants/pricing min(0) ────────
export const editProductSchema = createProductSchema.extend({
  variants: z.array(variantSchema).default([]),
  pricing:  z.array(pricingSchema).default([]),
})
export type EditProductFormValues = z.infer<typeof editProductSchema>
