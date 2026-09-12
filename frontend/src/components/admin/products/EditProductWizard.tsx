'use client'

import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { editProductSchema, type EditProductFormValues } from './schema'
import BasicInfoTab from './tabs/BasicInfoTab'
import CategoriesTab from './tabs/CategoriesTab'
// import EditVariantsTab from './tabs/EditVariantsTab' // VARIANTS DISABLED (multi-row table)
import ProductSpecsTab from './tabs/ProductSpecsTab'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { toastSuccess, toastError } from '@/lib/toast'

const TABS = [
  { key: 'basic',      label: 'Basic Info' },
  { key: 'categories', label: 'Categories' },
  { key: 'variants',   label: 'Tyre Specs' },
  { key: 'pricing',    label: 'Pricing' },
] as const

type TabKey = typeof TABS[number]['key']

interface ExistingSku {
  product_id: string
  sku: string
  tyre_size_display: string
  status: string
  total_available_stock: number
}

interface Props {
  patternId:   string
  initialData: EditProductFormValues
  existingSkus: ExistingSku[]
  brands:      { brand_id: string; brand_name: string }[]
  collections: { collection_id: string; collection_name: string }[]
  categories:  { category_id: string; category_name: string; category_type: string }[]
  patterns?:   { pattern_id: string; pattern_name: string; brand_id: string }[]
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function EditProductWizard({
  patternId, initialData, existingSkus, brands, collections, categories, patterns = [],
}: Props) {
  const router      = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [submitting, setSubmitting] = useState(false)

  const methods = useForm<EditProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(editProductSchema) as any,
    defaultValues: initialData,
  })

  const watchName = methods.watch('patternName') ?? ''
  const autoSlug  = watchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const tabIndex = TABS.findIndex(t => t.key === activeTab)

  async function handleSave(values: EditProductFormValues) {
    setSubmitting(true)
    console.group('[EditProductWizard] handleSave')
    console.log('form values:', values)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      console.log('auth token present:', !!token)
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

      // 1. PATCH pattern-level fields
      const patternPayload = {
        brandId:             values.brandId,
        patternName:         values.patternName,
        patternSlug:         values.patternSlug,
        shortDescription:    values.shortDescription || null,
        galleryImages:       values.galleryImages ?? [],
        tyreOverview:        values.tyreOverview || undefined,
        features:            values.features || undefined,
        warrantyInformation: values.warrantyInformation || undefined,
        tyreSpecSheet:       values.tyreSpecSheet || undefined,
        faqList:             values.faqList ?? [],
        defaultCountryOfOrigin: values.defaultCountryOfOrigin || undefined,
        isActive:            values.isActive,
        showOnWebsite:       values.showOnWebsite,
        seoTitle:            values.seoTitle || undefined,
        seoDescription:      values.seoDescription || undefined,
        treadImage:          values.treadImage || undefined,
        discountable:        values.discountable,
        applicationType:     values.applicationType,
        categoryIds:         values.categoryIds ?? [],
        performanceCategory: values.performanceCategory || undefined,
        seasonType:          values.seasonType || undefined,
        collectionId:        values.collectionId || undefined,
        tags:                values.tags ?? [],
        positionCategory:    values.positionCategory || undefined,
        shoulderType:        values.shoulderType || undefined,
        terrainType:         values.terrainType || undefined,
        warrantyKm:          values.warrantyKm || undefined,
      }

      console.log('PUT payload:', patternPayload)
      const patchRes = await fetch(`${API}/api/admin/products/${patternId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(patternPayload),
      })
      const patchBody = await patchRes.json().catch(() => ({}))
      console.log(`PUT /api/admin/products/${patternId} →`, patchRes.status, patchBody)
      if (!patchRes.ok) {
        throw new Error(patchBody.error ?? patchBody.message ?? `Failed to update product (${patchRes.status})`)
      }

      // POST / PATCH the single product spec (variants[0])
      for (let i = 0; i < (values.variants ?? []).length; i++) {
        const v = values.variants[i]
        const p = (values.pricing ?? [])[i] ?? {}
        const variantRes = await fetch(`${API}/api/admin/products/${patternId}/variants`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            variant: {
              sku:              v.sku,
              tyreSizeDisplay:  v.tyreSizeDisplay,
              width:            v.width,
              profile:          v.profile,
              rimSize:          v.rimSize,
              constructionType: v.constructionType,
              loadIndex:        v.loadIndex       || undefined,
              loadSpeedRating:  v.loadSpeedRating || undefined,
              speedRating:      v.speedRating     || undefined,
              fuelRating:       v.fuelRating      || undefined,
              wetGrip:          v.wetGrip         || undefined,
              noiseDb:          v.noiseDb         || undefined,
              noiseClass:       v.noiseClass      || undefined,
              runflat:          v.runflat,
              xlReinforced:     v.xlReinforced,
              plyRating:        v.plyRating       || undefined,
              loadRange:        v.loadRange       || undefined,
              sidewall:         v.sidewall,
              tubeType:         v.tubeType,
              countryOfOrigin:  v.countryOfOrigin,
              manufacturerName: v.manufacturerName || undefined,
              factoryName:      v.factoryName     || undefined,
              factoryCountry:   v.factoryCountry  || undefined,
              sectionWidth:     v.sectionWidth,
              treadDepth:       v.treadDepth,
              tyreWeight:       v.tyreWeight,
              overallDiameter:  v.overallDiameter,
              maxLoad:          v.maxLoad         || undefined,
              maxPressure:      v.maxPressure     || undefined,
              eMark:            v.eMark           || undefined,
              dotCode:          v.dotCode         || undefined,
              utqg:             v.utqg            || undefined,
              variantImages:    v.variantImages   ?? [],
            },
            pricing: {
              priceIncGst:    p.priceIncGst,
              compareAtPrice: p.compareAtPrice,
              costPrice:      p.costPrice,
              inventory:      p.inventory      ?? 0,
              lowStockAlert:  p.lowStockAlert  ?? 10,
            },
          }),
        })
        if (!variantRes.ok) {
          const body = await variantRes.json().catch(() => ({}))
          throw new Error(body.error ?? `Failed to save product specs (${v.sku || i + 1})`)
        }
      }

      toastSuccess('Product saved successfully')
      console.log('save complete — navigating to product detail')
      console.groupEnd()
      // refresh first so the router cache is busted before we land on the detail page
      router.refresh()
      router.push(`/admin/products/${patternId}?t=${Date.now()}`)
    } catch (err) {
      console.error('[EditProductWizard] save error:', err)
      console.groupEnd()
      toastError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  function handleInvalid() {
    toastError('Please fill in all required fields before saving.')
  }

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col h-full min-h-screen bg-zinc-50">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-4 border-b border-zinc-200 bg-white sticky top-0 z-10 overflow-x-auto">
          <button
            type="button"
            onClick={() => router.push(`/admin/products/${patternId}`)}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mr-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            esc
          </button>

          <span className="text-sm font-medium text-zinc-400 mr-3">
            Edit: <span className="text-zinc-700">{methods.watch('patternName')}</span>
          </span>

          <div className="flex gap-1">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-primary text-zinc-900 border border-primary'
                    : 'text-zinc-500 hover:text-zinc-900 hover:!bg-zinc-100'
                )}
              >
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs',
                  activeTab === tab.key
                    ? 'bg-zinc-900 text-white'
                    : 'border border-zinc-300 text-zinc-400'
                )}>
                  {i + 1}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
          {activeTab === 'basic' && (
            <BasicInfoTab autoSlug={autoSlug} brands={brands} patterns={patterns} />
          )}
          {activeTab === 'categories' && (
            <CategoriesTab collections={collections} categories={categories} />
          )}
          {activeTab === 'variants' && <ProductSpecsTab />}
          {activeTab === 'pricing' && (
            <div className="py-20 text-center">
              <p className="text-sm text-zinc-400">Pricing will be configured after variants are added.</p>
            </div>
          )}
        </div>

        {/* ── Footer actions ───────────────────────────────── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-zinc-200 bg-white sticky bottom-0 z-10">
          <div className="flex gap-2">
            {tabIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab(TABS[tabIndex - 1].key)}
              >
                ← Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/admin/products/${patternId}`)}
            >
              Cancel
            </Button>

            {activeTab !== 'pricing' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab(TABS[tabIndex + 1].key)}
              >
                Next →
              </Button>
            ) : null}

            <Button
              type="button"
              disabled={submitting}
              onClick={methods.handleSubmit(handleSave, handleInvalid)}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </FormProvider>
  )
}

