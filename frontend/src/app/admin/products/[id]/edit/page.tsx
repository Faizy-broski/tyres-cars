'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import EditProductForm from '@/components/admin/products/EditProductForm'
import type { EditProductFormValues } from '@/components/admin/products/schema'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Meta = {
  brands:      { brand_id: string; brand_name: string }[]
  collections: { collection_id: string; collection_name: string }[]
  categories:  { category_id: string; category_name: string; category_type: string }[]
  patterns:    { pattern_id: string; pattern_name: string; brand_id: string }[]
}

interface ExistingSku {
  product_id: string
  sku: string
  tyre_size_display: string
  status: string
  total_available_stock: number
  width: number | null
  profile: number | null
  rim_size: number | null
  load_index: string | null
  speed_rating: string | null
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()

  const [initialData, setInitialData] = useState<EditProductFormValues | null>(null)
  const [existingSkus, setExistingSkus] = useState<ExistingSku[]>([])
  const [patternInfo, setPatternInfo] = useState<{ name: string; brandName: string } | null>(null)
  const [meta, setMeta]   = useState<Meta>({ brands: [], collections: [], categories: [], patterns: [] })
  const [warehouses, setWarehouses] = useState<{ warehouse_id: string; warehouse_name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'Edit Product | Tyres & Car Valeting' }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        const headers = { Authorization: `Bearer ${tok}` }

        const [productRes, metaRes, whRes] = await Promise.all([
          fetch(`${API}/api/admin/products/${id}`, { headers }),
          fetch(`${API}/api/admin/products/meta`, { headers }),
          fetch(`${API}/api/admin/orders/warehouses`, { headers }),
        ])

        if (!productRes.ok) {
          const body = await productRes.json().catch(() => ({}))
          throw new Error(body.error ?? `Failed to load product (${productRes.status})`)
        }
        if (!metaRes.ok) {
          throw new Error(`Failed to load product metadata (${metaRes.status})`)
        }

        const productJson = await productRes.json()
        const metaJson: Meta = await metaRes.json()
        const whJson: { warehouse_id: string; warehouse_name: string }[] = whRes.ok
          ? await whRes.json().catch(() => [])
          : []

        const p = productJson.pattern
        const skus: ExistingSku[] = (productJson.skus ?? []).map((s: any) => ({
          product_id:            s.product_id,
          sku:                   s.sku,
          tyre_size_display:     s.tyre_size_display,
          status:                s.status,
          total_available_stock: s.total_available_stock ?? 0,
          width:                 s.width ?? null,
          profile:               s.profile ?? null,
          rim_size:              s.rim_size ?? null,
          load_index:            s.load_index ?? null,
          speed_rating:          s.speed_rating ?? null,
        }))

        // Map API pattern → form values
        const formValues: EditProductFormValues = {
          brandId:             p.brand_id ?? (p.brands?.brand_id ?? ''),
          patternName:         p.pattern_name ?? '',
          patternSlug:         p.pattern_slug ?? '',
          shortDescription:    p.pattern_short_description ?? '',
          galleryImages:       Array.isArray(p.gallery_images) ? p.gallery_images : [],
          tyreOverview:        p.tyre_overview ?? '',
          features:            p.features ?? '',
          warrantyInformation: p.warranty_information ?? '',
          tyreSpecSheet:       p.tyre_spec_sheet ?? '',
          faqList:             Array.isArray(p.faq_list) ? p.faq_list : [],
          defaultCountryOfOrigin: p.default_country_of_origin ?? '',
          isActive:            p.is_active ?? true,
          showOnWebsite:       p.show_on_website ?? false,
          seoTitle:            p.seo_title ?? '',
          seoDescription:      p.seo_description ?? '',
          treadImage:          p.tread_image ?? '',
          discountable:        p.discountable ?? true,
          applicationType:     p.application_type ?? 'PCR',
          categoryIds:         (p.pattern_categories ?? []).map(
            (pc: { categories: { category_id: string } | null }) => pc.categories?.category_id ?? ''
          ).filter(Boolean),
          performanceCategory: p.performance_category ?? '',
          seasonType:          p.season_type ?? '',
          collectionId:        p.collection_id ?? '',
          tags:                Array.isArray(p.tags) ? p.tags : [],
          positionCategory:    p.position_category ?? undefined,
          shoulderType:        p.shoulder_type ?? undefined,
          terrainType:         p.terrain_type ?? '',
          warrantyKm:          p.warranty_km ?? undefined,
          // Populate one variants[] / pricing[] row per existing SKU so the Pricing &
          // Inventory table (which loops over `variants`) shows every sibling size, not just the first.
          variants: skus.length > 0 ? productJson.skus.map((s: any) => ({
            sku:              s.sku ?? '',
            barcodeEan:       '',
            tyreSizeDisplay:  s.tyre_size_display ?? '',
            width:            s.width ?? undefined,
            profile:          s.profile ?? undefined,
            rimSize:          s.rim_size ?? 0,
            specialSize:      '',
            constructionType: undefined,
            speedRating:      s.speed_rating ?? '',
            loadIndex:        s.load_index ?? '',
            loadSpeedRating:  '',
            fuelRating:       '',
            wetGrip:          '',
            noiseDb:          '',
            noiseClass:       '',
            runflat:          false,
            xlReinforced:     false,
            ltSizing:         false,
            plyRating:        '',
            loadRange:        '',
            sidewall:         undefined,
            tubeType:         undefined,
            manufacturerName: '',
            countryOfOrigin:  p.default_country_of_origin ?? '',
            factoryName:      '',
            factoryCountry:   '',
            sectionWidth:     undefined,
            treadDepth:       undefined,
            tyreWeight:       undefined,
            overallDiameter:  undefined,
            maxLoad:          '',
            maxPressure:      '',
            eMark:            '',
            dotCode:          '',
            utqg:             '',
            variantImages:    [],
            status:           (s.status as 'active' | 'inactive' | 'discontinued') ?? 'active',
            replacementProductId: '',
          })) : [{
            sku: '', barcodeEan: '', tyreSizeDisplay: '', width: undefined, profile: undefined,
            rimSize: 0, specialSize: '', constructionType: undefined, speedRating: '', loadIndex: '',
            loadSpeedRating: '', fuelRating: '', wetGrip: '', noiseDb: '', noiseClass: '',
            runflat: false, xlReinforced: false, ltSizing: false, plyRating: '', loadRange: '',
            sidewall: undefined, tubeType: undefined, manufacturerName: '',
            countryOfOrigin: p.default_country_of_origin ?? '',
            factoryName: '', factoryCountry: '', sectionWidth: undefined, treadDepth: undefined,
            tyreWeight: undefined, overallDiameter: undefined, maxLoad: '', maxPressure: '',
            eMark: '', dotCode: '', utqg: '', variantImages: [], status: 'active' as const,
            replacementProductId: '',
          }],
          pricing: productJson.skus.map((s: any) => {
            const price = (s.product_prices ?? []).find((pr: any) => pr.price_type === 'retail') ?? (s.product_prices ?? [])[0]
            const stock = (s.product_stock ?? [])[0]
            return {
              priceIncGst:    price?.price_inc_gst ?? 0,
              compareAtPrice: s.compare_at_price ?? undefined,
              costPrice:      s.cost_price ?? undefined,
              inventory:      stock?.available_stock ?? 0,
              lowStockAlert:  s.low_stock_alert ?? 10,
              warehouseId:    stock?.warehouse_id ?? '',
            }
          }),
        }

        if (!cancelled) {
          setInitialData(formValues)
          setExistingSkus(skus)
          setPatternInfo({ name: p.pattern_name ?? '', brandName: p.brands?.brand_name ?? '' })
          setMeta(metaJson)
          setWarehouses(Array.isArray(whJson) ? whJson : [])
        }
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load product')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Loading product…</p>
      </div>
    )
  }

  if (!initialData) {
    return (
      <div className="p-4 sm:p-6">
        <p className="mt-6 text-sm text-zinc-500">Product not found.</p>
      </div>
    )
  }

  return (
    <EditProductForm
      patternId={id}
      initialData={initialData}
      brands={meta.brands}
      collections={meta.collections}
      categories={meta.categories}
      warehouses={warehouses}
      patterns={meta.patterns}
      existingSkus={existingSkus}
      patternInfo={patternInfo ?? undefined}
    />
  )
}
