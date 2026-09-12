'use client'

import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import type { FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createProductSchema, type CreateProductFormValues } from './schema'
import BasicInfoTab from './tabs/BasicInfoTab'
import CategoriesTab from './tabs/CategoriesTab'
// import VariantsTab from './tabs/VariantsTab' // VARIANTS DISABLED (multi-row table)
import ProductSpecsTab from './tabs/ProductSpecsTab'
import PricingTab from './tabs/PricingTab'
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

type Props = {
  brands:      { brand_id: string; brand_name: string }[]
  collections: { collection_id: string; collection_name: string }[]
  categories:  { category_id: string; category_name: string; category_type: string }[]
  patterns?:   { pattern_id: string; pattern_name: string; brand_id: string }[]
}

export default function CreateProductWizard({ brands, collections, categories, patterns = [] }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [completedTabs, setCompletedTabs] = useState<Set<TabKey>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [appliedPattern, setAppliedPattern] = useState<{ id: string; name: string } | null>(null)

  const methods = useForm<CreateProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createProductSchema) as any,
    defaultValues: {
      brandId: '',
      patternName: '',
      patternSlug: '',
      shortDescription: '',
      galleryImages: [],
      tyreOverview: '',
      features: '',
      warrantyInformation: '',
      tyreSpecSheet: '',
      faqList: [],
      isActive: true,
      showOnWebsite: false,
      discountable: true,
      applicationType: 'PCR',
      categoryIds: [],
      performanceCategory: '',
      seasonType: '',
      collectionId: '',
      tags: [],
      variants: [{
        sku: '', barcodeEan: '', tyreSizeDisplay: '', width: undefined, profile: undefined,
        rimSize: 0, specialSize: '', constructionType: undefined, speedRating: '', loadIndex: '',
        loadSpeedRating: '', fuelRating: '', wetGrip: '', noiseDb: '', noiseClass: '',
        runflat: false, xlReinforced: false, ltSizing: false, plyRating: '', loadRange: '',
        sidewall: undefined, tubeType: undefined, manufacturerName: '', countryOfOrigin: '',
        factoryName: '', factoryCountry: '', sectionWidth: undefined, treadDepth: undefined,
        tyreWeight: undefined, overallDiameter: undefined, maxLoad: '', maxPressure: '',
        eMark: '', dotCode: '', utqg: '', variantImages: [], status: 'active' as const,
        replacementProductId: '',
      }],
      pricing: [],
    },
  })

  // Auto-generate slug from pattern name
  const watchName = methods.watch('patternName')
  const autoSlug  = watchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  function goToTab(tab: TabKey) {
    setActiveTab(tab)
  }

  function markTabComplete(tab: TabKey) {
    setCompletedTabs(prev => new Set([...prev, tab]))
  }

  function handleInvalid(errs: FieldErrors<CreateProductFormValues>) {
    const msgs: string[] = []
    if (errs.brandId)      msgs.push('Brand is required')
    if (errs.patternName)  msgs.push('Product name is required')
    if (errs.patternSlug)  msgs.push('Slug is required')
    if (errs.variants)     msgs.push('Check Tyre Specs — SKU, Tyre Size, Rim Size and Country are required')
    if (errs.pricing)      msgs.push('Fill in Price (inc. GST) for each variant')
    toastError(msgs.length ? msgs.join(' · ') : 'Please fill in all required fields before publishing')
    if (errs.brandId || errs.patternName || errs.patternSlug) setActiveTab('basic')
    else if (errs.variants) setActiveTab('variants')
    else if (errs.pricing)  setActiveTab('pricing')
  }

  async function handlePublish(values: CreateProductFormValues) {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const payload = {
        ...values,
        collectionId:        values.collectionId        || undefined,
        performanceCategory: values.performanceCategory || undefined,
        seasonType:          values.seasonType          || undefined,
        galleryImages:       values.galleryImages ?? [],
        variants: values.variants.map(v => ({
          ...v,
          loadIndex:       v.loadIndex       || undefined,
          speedRating:     v.speedRating     || undefined,
          fuelRating:      v.fuelRating      || undefined,
          wetGrip:         v.wetGrip         || undefined,
          noiseDb:         v.noiseDb         || undefined,
          noiseClass:      v.noiseClass      || undefined,
          plyRating:       v.plyRating       || undefined,
          loadRange:       v.loadRange       || undefined,
          countryOfOrigin: v.countryOfOrigin || undefined,
        })),
      }
      const res = await fetch(`${API}/api/admin/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? body.message ?? 'Failed to create product')
      }
      const { patternId } = await res.json()
      toastSuccess('Product created successfully')
      router.push(`/admin/products/${patternId}`)
      router.refresh()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const tabIndex = TABS.findIndex(t => t.key === activeTab)

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col h-full">
        {/* Wizard header */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-4 border-b border-zinc-200 bg-white overflow-x-auto">
          {/* Close / esc */}
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mr-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            esc
          </button>

          {/* Tab steps */}
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => goToTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-zinc-900 border border-primary'
                  : completedTabs.has(tab.key)
                  ? 'text-zinc-700 hover:!bg-zinc-100'
                  : 'text-zinc-400 cursor-default'
              )}
            >
              {/* Step indicator */}
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-xs',
                activeTab === tab.key
                  ? 'bg-primary border border-primary/20 text-zinc-900'
                  : completedTabs.has(tab.key)
                  ? 'bg-zinc-800 text-white'
                  : 'border border-zinc-300 text-zinc-400'
              )}>
                {completedTabs.has(tab.key) && activeTab !== tab.key ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : i + 1}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
          {activeTab === 'basic'      && <BasicInfoTab autoSlug={autoSlug} brands={brands} patterns={patterns} onPatternApplied={setAppliedPattern} />}
          {activeTab === 'categories' && <CategoriesTab collections={collections} categories={categories} appliedPattern={appliedPattern} />}
          {activeTab === 'variants'   && <ProductSpecsTab />}
          {activeTab === 'pricing'    && <PricingTab />}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-zinc-200 bg-white">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>

          {activeTab !== 'pricing' ? (
            <Button
              type="button"
              onClick={() => {
                markTabComplete(activeTab)
                const next = TABS[tabIndex + 1]
                if (next) setActiveTab(next.key)
              }}
            >
              Save & Continue
            </Button>
          ) : (
            <Button
              type="button"
              disabled={submitting}
              onClick={methods.handleSubmit(handlePublish, handleInvalid)}
            >
              {submitting ? 'Publishing…' : 'Publish'}
            </Button>
          )}
        </div>
      </div>
    </FormProvider>
  )
}

