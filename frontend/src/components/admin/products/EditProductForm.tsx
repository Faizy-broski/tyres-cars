'use client'

import { useRef, useState, useCallback } from 'react'
import { useForm, FormProvider, useFormContext, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { editProductSchema, type EditProductFormValues } from './schema'
import { CreatableCombobox, CreatableMultiCombobox, TagInput, slugify } from '@/components/ui/CreatableCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { uploadProductImage, deleteProductImage } from '@/lib/upload-image'
import { normalizeTyreSize } from '@/lib/utils/size-normalizer'
import { toastSuccess, toastError } from '@/lib/toast'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const inputCls =
  'w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors bg-white'
const selectCls =
  'w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors'
const labelCls = 'block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5'

const APPLICATION_TYPES = [
  { value: 'PCR', label: 'PCR — Passenger Car' },
  { value: '4x4', label: '4x4 / SUV' },
  { value: 'TBR', label: 'TBR — Truck / Bus' },
]
const PERFORMANCE_CATEGORIES = ['HP', 'UHP', 'HT', 'AT', 'RT', 'MT', 'XT', 'ECO', 'COMMERCIAL']
const SEASON_TYPES = [
  { value: 'summer',     label: 'Summer' },
  { value: 'winter',     label: 'Winter' },
  { value: 'all_season', label: 'All Season' },
]
const COMMON_TAGS = [
  'suv', 'quiet', 'comfort', 'performance', 'runflat', 'xl', 'wet', 'fuel-efficient',
  'highway', 'all-terrain', 'mud-terrain', 'commercial', '4x4', 'sport',
]

const IDX = 0

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3 mb-4 border-b border-zinc-100">
      <h2 className="text-base font-semibold text-zinc-900">{children}</h2>
    </div>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100 bg-zinc-50/60">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 text-zinc-800 shrink-0">
          {icon}
        </span>
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Toggle({ field, label, description }: { field: 'isActive' | 'showOnWebsite' | 'discountable'; label: string; description: string }) {
  const { watch, setValue } = useFormContext<EditProductFormValues>()
  const val = watch(field)
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={!!val}
          onClick={() => setValue(field, !val)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5 ${val ? 'bg-primary' : 'bg-zinc-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        <div>
          <span className="text-sm font-medium text-zinc-800">{label}</span>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )
}

function RichField({ name, label }: { name: 'tyreOverview' | 'features' | 'warrantyInformation' | 'tyreSpecSheet'; label: string }) {
  const { watch, setValue } = useFormContext<EditProductFormValues>()
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      <RichTextEditor value={watch(name) ?? ''} onChange={v => setValue(name, v)} placeholder={`Enter ${label.toLowerCase()}…`} />
    </div>
  )
}

function calcMargin(price: number, cost: number): string {
  if (!price || !cost) return '—'
  return ((1 - cost / price) * 100).toFixed(1) + '%'
}

// ─────────────────────────────────────────────────────────────────────────────

interface SkuCodeRow {
  product_id: string; sku: string; tyre_size_display: string
  width: number | null; profile: number | null; rim_size: number | null
  load_index: string | null; speed_rating: string | null
}

interface Props {
  patternId:    string
  initialData:  EditProductFormValues
  brands:       { brand_id: string; brand_name: string }[]
  collections:  { collection_id: string; collection_name: string }[]
  categories:   { category_id: string; category_name: string; category_type: string }[]
  patterns?:    { pattern_id: string; pattern_name: string; brand_id: string }[]
  existingSkus?: SkuCodeRow[]
  patternInfo?:  { name: string; brandName: string }
}

export default function EditProductForm({
  patternId, initialData, brands, collections, categories, patterns = [],
  existingSkus = [], patternInfo,
}: Props) {
  const router      = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const methods = useForm<EditProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(editProductSchema) as any,
    defaultValues: initialData,
  })

  const watchName = methods.watch('patternName') ?? ''
  const autoSlug  = watchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  async function handleSave(values: EditProductFormValues) {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

      // 1. PUT pattern-level fields
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

      const patchRes = await fetch(`${API}/api/admin/products/${patternId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(patternPayload),
      })
      const patchBody = await patchRes.json().catch(() => ({}))
      if (!patchRes.ok) {
        throw new Error(patchBody.error ?? patchBody.message ?? `Failed to update product (${patchRes.status})`)
      }

      // 2. PATCH pricing/inventory for every sibling size shown in the Pricing & Inventory table
      //    (existingSkus and values.pricing are index-aligned — both built from the same SKU list)
      async function saveRow(i: number) {
        const variantId = existingSkus[i]?.product_id
        const p = values.pricing?.[i]
        if (!variantId || !p) return

        const [skuRes, priceRes, stockRes] = await Promise.all([
          fetch(`${API}/api/admin/products/${patternId}/variants/${variantId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              compareAtPrice: p.compareAtPrice ?? null,
              costPrice: p.costPrice ?? null,
              lowStockAlert: p.lowStockAlert ?? null,
            }),
          }),
          p.priceIncGst != null
            ? fetch(`${API}/api/admin/products/${patternId}/variants/${variantId}/prices`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ prices: { Retail: p.priceIncGst } }),
              })
            : null,
          fetch(`${API}/api/admin/products/${patternId}/variants/${variantId}/stock`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              availableStock: p.inventory ?? 0,
              lowStockAlert: p.lowStockAlert,
            }),
          }),
        ])

        if (!skuRes.ok) {
          const body = await skuRes.json().catch(() => ({}))
          throw new Error(body.error ?? body.message ?? `Failed to update pricing for ${existingSkus[i].tyre_size_display}`)
        }
        if (priceRes && !priceRes.ok) {
          const body = await priceRes.json().catch(() => ({}))
          throw new Error(body.error ?? body.message ?? `Failed to update price for ${existingSkus[i].tyre_size_display}`)
        }
        if (stockRes && !stockRes.ok) {
          const body = await stockRes.json().catch(() => ({}))
          throw new Error(body.error ?? body.message ?? `Failed to update stock for ${existingSkus[i].tyre_size_display}`)
        }
      }

      await Promise.all(existingSkus.map((_, i) => saveRow(i)))

      toastSuccess('Product saved successfully')
      router.refresh()
      router.push(`/admin/products/${patternId}?t=${Date.now()}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  function handleInvalid() {
    toastError('Please fill in all required fields before saving.')
  }

  return (
    <FormProvider {...methods}>
      <FormBody
        patternId={patternId}
        autoSlug={autoSlug}
        brands={brands}
        patterns={patterns}
        categories={categories}
        submitting={submitting}
        onCancel={() => router.push(`/admin/products/${patternId}`)}
        onSave={methods.handleSubmit(handleSave, handleInvalid)}
        productName={watchName}
        existingSkus={existingSkus}
        patternInfo={patternInfo}
      />
    </FormProvider>
  )
}

// ── Inner body ────────────────────────────────────────────────────────────────

function FormBody({
  patternId, autoSlug, brands, patterns, categories,
  submitting, onCancel, onSave, productName, existingSkus = [], patternInfo,
}: {
  patternId:   string
  autoSlug:    string
  brands:      { brand_id: string; brand_name: string }[]
  patterns:    { pattern_id: string; pattern_name: string; brand_id: string }[]
  categories:  { category_id: string; category_name: string; category_type: string }[]
  submitting:  boolean
  onCancel:    () => void
  onSave:      () => void
  productName: string
  existingSkus?: SkuCodeRow[]
  patternInfo?:  { name: string; brandName: string }
}) {
  const { register, watch, setValue, control, formState: { errors } } = useFormContext<EditProductFormValues>()

  const brandId = watch('brandId')
  const brandPatterns = patterns.filter(p => p.brand_id === brandId)
  const [patternLoading, setPatternLoading] = useState(false)

  const applyPattern = useCallback(async (patternId: string) => {
    if (!patternId || !brandId) return
    setPatternLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const tok = session?.access_token ?? ''
      const res = await fetch(`${API}/api/admin/products/brands/${brandId}/patterns/${patternId}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Failed to load pattern')
      const p = await res.json()

      setValue('patternName',         p.pattern_name ?? '',  { shouldValidate: true })
      setValue('patternSlug',         p.pattern_slug ?? '')
      setValue('shortDescription',    p.pattern_short_description ?? '')
      setValue('tyreOverview',        p.tyre_overview ?? '')
      setValue('features',            p.features ?? '')
      setValue('warrantyInformation', p.warranty_information ?? '')
      setValue('tyreSpecSheet',       p.tyre_spec_sheet ?? '')
      setValue('galleryImages',       Array.isArray(p.gallery_images) ? p.gallery_images : [])
      setValue('treadImage',          p.tread_image ?? '')
      setValue('seoTitle',            p.seo_title ?? '')
      setValue('seoDescription',      p.seo_description ?? '')
      setValue('isActive',            p.is_active ?? true)
      setValue('showOnWebsite',       p.show_on_website ?? false)
      setValue('discountable',        p.discountable ?? true)
      if (p.application_type)     setValue('applicationType',     p.application_type)
      if (p.season_type)          setValue('seasonType',          p.season_type)
      if (p.performance_category) setValue('performanceCategory', p.performance_category)
      if (p.position_category)    setValue('positionCategory',    p.position_category)
      if (p.shoulder_type)        setValue('shoulderType',        p.shoulder_type)
      if (p.terrain_type)         setValue('terrainType',         p.terrain_type)
      if (p.warranty_km != null)  setValue('warrantyKm',          p.warranty_km)
      if (p.collection_id)        setValue('collectionId',        p.collection_id)
      if (Array.isArray(p.pattern_categories)) {
        setValue('categoryIds', p.pattern_categories.map((c: { category_id: string }) => c.category_id))
      }
      toastSuccess(`Fields copied from pattern: ${p.pattern_name}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to load pattern details')
    } finally {
      setPatternLoading(false)
    }
  }, [brandId, setValue])

  // ── Media ─────────────────────────────────────────────────────────────────
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const galleryImages = watch('galleryImages') ?? []
  const [uploading,   setUploading]   = useState(false)
  const [dragIdx,     setDragIdx]     = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  function reorder(from: number, to: number) {
    if (from === to) return
    const next = [...galleryImages]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setValue('galleryImages', next)
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray<EditProductFormValues, 'faqList'>({ name: 'faqList' })

  // ── Categories ────────────────────────────────────────────────────────────
  const selectedTags        = watch('tags') ?? []
  const selectedCats        = watch('categoryIds') ?? []
  const applicationType     = watch('applicationType')
  const performanceCategory = watch('performanceCategory') ?? ''
  const seasonType          = watch('seasonType') ?? ''

  // ── Tyre specs ────────────────────────────────────────────────────────────
  function handleSizeBlur(raw: string) {
    if (!raw) return
    try {
      normalizeTyreSize(raw)
      const metric = raw.match(/^(\d{2,3})[/\\](\d{2,3})[ZzRrDd-]?(\d{2,3})/i)
      if (metric) {
        setValue(`variants.${IDX}.width`,   Number(metric[1]))
        setValue(`variants.${IDX}.profile`, Number(metric[2]))
        setValue(`variants.${IDX}.rimSize`, Number(metric[3]))
        return
      }
      const imperial = raw.match(/^(\d{2,3})[xX](\d{2,3}(?:\.\d+)?)[Rr-](\d{2,3})/i)
      if (imperial) {
        setValue(`variants.${IDX}.width`,   Number(imperial[1]))
        setValue(`variants.${IDX}.profile`, Number(imperial[2]))
        setValue(`variants.${IDX}.rimSize`, Number(imperial[3]))
      }
    } catch { /* invalid size */ }
  }

  // ── Pricing ───────────────────────────────────────────────────────────────
  const variants = useWatch({ control, name: 'variants' }) ?? []
  const pricing  = useWatch({ control, name: 'pricing'  }) ?? []

  return (
    <div className="flex flex-col h-full min-h-screen bg-zinc-50">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-4 sm:px-6 py-3 border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 shadow-sm">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-medium text-amber-700/70 hover:text-amber-900 transition-colors px-2.5 py-1.5 rounded-md hover:bg-amber-100/70"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          esc
        </button>

        <div className="w-px h-4 bg-amber-200" />

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 uppercase tracking-wide">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Editing
          </span>
          <span className="text-sm font-semibold text-zinc-800 truncate max-w-xs sm:max-w-sm">{productName}</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-10">

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1 · GENERAL
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading>General</SectionHeading>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Brand */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Brand <span className="text-red-500">*</span></label>
              <CreatableCombobox
                options={brands.map(b => ({ value: b.brand_id, label: b.brand_name }))}
                value={brandId ?? ''}
                onChange={v => setValue('brandId', v, { shouldValidate: true })}
                onCreate={async (name) => {
                  const { data: { session } } = await createClient().auth.getSession()
                  const tok = session?.access_token ?? ''
                  const res = await fetch(`${API}/api/admin/products/brands`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                    body: JSON.stringify({ brand_name: name, brand_slug: slugify(name) }),
                  })
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error ?? 'Failed to create brand')
                  }
                  const data = await res.json()
                  return { value: data.brand_id, label: data.brand_name }
                }}
                placeholder="Select or create brand…"
              />
              {errors.brandId && <p className="mt-1 text-xs text-red-600">{errors.brandId.message}</p>}
            </div>

            {/* Copy from pattern (optional — will overwrite current values) */}
            {brandPatterns.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Copy from pattern
                  <span className="ml-1 text-xs font-normal text-zinc-400">(overwrites current values)</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 disabled:opacity-50"
                    defaultValue=""
                    disabled={patternLoading}
                    onChange={e => e.target.value && applyPattern(e.target.value)}
                  >
                    <option value="">— Select pattern —</option>
                    {brandPatterns.map(p => (
                      <option key={p.pattern_id} value={p.pattern_id}>{p.pattern_name}</option>
                    ))}
                  </select>
                  {patternLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 animate-pulse pointer-events-none">
                      Loading…
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Title <span className="text-red-500">*</span></label>
              <Input
                {...register('patternName')}
                onBlur={() => { if (!watch('patternSlug')) setValue('patternSlug', autoSlug) }}
                placeholder="Michelin Pilot Sport 4"
              />
              {errors.patternName && <p className="mt-1 text-xs text-red-600">{errors.patternName.message}</p>}
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Slug <span className="text-red-500">*</span></label>
              <div className="flex items-center rounded-lg border border-zinc-300 overflow-hidden focus-within:ring-2 focus-within:ring-zinc-500/20 focus-within:border-zinc-500">
                <span className="px-2 text-zinc-400 text-sm select-none border-r border-zinc-300 bg-zinc-50 py-2">/</span>
                <input
                  {...register('patternSlug')}
                  placeholder={autoSlug || 'product-slug'}
                  className="flex-1 px-3 py-2 text-sm focus:outline-none bg-transparent border-0 shadow-none focus-visible:ring-0"
                />
              </div>
              {errors.patternSlug && <p className="mt-1 text-xs text-red-600">{errors.patternSlug.message}</p>}
            </div>
          </div>

          {/* SKU reference codes */}
          {existingSkus.length > 0 && (
            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-zinc-100 p-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 p-3">
              {existingSkus.map(sku => {
                const defaultHelper = [
                  sku.width    != null ? Math.floor(sku.width)    : '',
                  sku.profile  != null ? Math.floor(sku.profile)  : '',
                  sku.rim_size != null ? Math.floor(sku.rim_size) : '',
                ].join('')
                const defaultSupplier = [
                  patternInfo?.brandName,
                  sku.tyre_size_display,
                  patternInfo?.name,
                  sku.load_index,
                  sku.speed_rating?.toUpperCase(),
                ].filter(Boolean).join(' ')

                async function saveCode(field: 'helperCode' | 'supplierCode', value: string) {
                  try {
                    const { data: { session } } = await createClient().auth.getSession()
                    const tok = session?.access_token ?? ''
                    await fetch(`${API}/api/admin/products/${patternId}/variants/${sku.product_id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                      body: JSON.stringify({ [field]: value }),
                    })
                  } catch { /* silent */ }
                }

                return (
                  <div key={sku.product_id} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 space-y-3">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">{sku.tyre_size_display}</p>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Item Code</label>
                      <input
                        readOnly
                        disabled
                        value={sku.sku}
                        className="w-full rounded border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-xs font-mono text-zinc-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Helper Code</label>
                      <input
                        key={`helper-${sku.product_id}`}
                        defaultValue={(sku as any).helper_code ?? defaultHelper}
                        onBlur={e => saveCode('helperCode', e.target.value)}
                        className="w-full rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-mono text-zinc-800 focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Supplier Code</label>
                      <input
                        key={`supplier-${sku.product_id}`}
                        defaultValue={(sku as any).supplier_code ?? defaultSupplier}
                        onBlur={e => saveCode('supplierCode', e.target.value)}
                        className="w-full rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
          )}

          {/* Short description */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Short Description</label>
            <Textarea {...register('shortDescription')} rows={3} placeholder="Brief description of tyre product…" className="resize-none placeholder-zinc-400" />
          </div>

          {/* Default Country of Origin */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Default Country of Origin
              <span className="ml-1 text-xs font-normal text-zinc-400">(pattern-level fallback — overridden per variant)</span>
            </label>
            <Input {...register('defaultCountryOfOrigin')} placeholder="CN" maxLength={3} className="w-24 uppercase" />
          </div>

          {/* Media */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Media</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (!files.length) return
                setUploading(true)
                try {
                  const urls = await Promise.all(files.map(f => uploadProductImage(f, 'gallery')))
                  setValue('galleryImages', [...galleryImages, ...urls])
                } catch (err) {
                  toastError(err instanceof Error ? err.message : 'Upload failed')
                } finally {
                  setUploading(false)
                }
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-2 transition-colors ${
                uploading ? 'border-zinc-200 bg-zinc-50 cursor-wait' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 cursor-pointer'
              }`}
            >
              {uploading ? (
                <>
                  <svg className="w-6 h-6 text-zinc-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <p className="text-sm text-zinc-500">Uploading…</p>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-zinc-500"><span className="font-medium text-zinc-700">Upload Images</span></p>
                  <p className="text-xs text-zinc-400">JPEG, PNG, WebP, GIF or AVIF · max 5 MB each</p>
                </>
              )}
            </div>
            {galleryImages.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-zinc-400 mb-2">Drag to reorder · First image is the <span className="font-semibold text-zinc-600">cover</span></p>
                <div className="flex flex-wrap gap-3">
                  {galleryImages.map((src, i) => {
                    const isCover   = i === 0
                    const isDragged = dragIdx === i
                    const isOver    = dragOverIdx === i
                    return (
                      <div
                        key={src}
                        draggable
                        onDragStart={() => { setDragIdx(i); setDragOverIdx(null) }}
                        onDragEnter={() => setDragOverIdx(i)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (dragIdx !== null) reorder(dragIdx, i); setDragIdx(null); setDragOverIdx(null) }}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                        className={`relative w-24 h-24 rounded-xl border-2 overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-150 ${
                          isDragged ? 'opacity-40 scale-95' : isOver ? 'border-primary scale-105 shadow-lg' : isCover ? 'border-primary' : 'border-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        {isCover && (
                          <span className="absolute top-1 left-1 bg-primary text-zinc-900 text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none select-none">Cover</span>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity">
                          {!isCover && (
                            <Button type="button" onClick={() => { if (i !== 0) reorder(i, 0) }} size="xs" className="bg-white/90 hover:bg-white text-zinc-800">
                              <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              Set cover
                            </Button>
                          )}
                          <Button
                            type="button"
                            onClick={async () => {
                              setValue('galleryImages', galleryImages.filter((_, j) => j !== i))
                              await deleteProductImage(src).catch(() => {})
                            }}
                            size="xs"
                            className="bg-red-500 hover:bg-red-600 text-white"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Remove
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 · PRODUCT DETAILS
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading>Product Details</SectionHeading>
          <div className="space-y-4">
            <RichField name="tyreOverview"        label="Tyre Overview" />
            <RichField name="features"            label="Features" />
            <RichField name="warrantyInformation" label="Warranty Information" />
            <RichField name="tyreSpecSheet"       label="Tyre Spec Sheet" />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3 · SEO & VISIBILITY
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading>SEO &amp; Visibility</SectionHeading>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Toggle field="isActive"      label="Is Active"       description="Pattern is enabled in admin — inactive patterns are hidden from all views" />
            <Toggle field="showOnWebsite" label="Show on Website" description="Product will be visible to customers on the storefront" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">SEO Title</label>
              <Input {...register('seoTitle')} placeholder="Michelin Pilot Sport 4 Tyres — Buy Online" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">SEO Description</label>
              <Input {...register('seoDescription')} placeholder="Short meta description for search engines" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Tread Image URL</label>
            <Input {...register('treadImage')} placeholder="https://cdn.example.com/tread-pattern.jpg" />
            <p className="mt-1 text-xs text-zinc-400">Close-up tread pattern image shown on product detail page</p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 4 · CLASSIFICATION
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading>Classification</SectionHeading>

          <div className="mb-5">
            <Toggle field="discountable" label="Discountable" description="When unchecked, discounts will not be applied to this product" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Product Type</label>
              <select
                {...register('applicationType')}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                <option value="">Select a type…</option>
                {APPLICATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Tyre Type</label>
              <CreatableCombobox
                options={PERFORMANCE_CATEGORIES.map(c => ({ value: c, label: c }))}
                value={performanceCategory}
                onChange={v => setValue('performanceCategory', v)}
                onCreate={async name => ({ value: name.toUpperCase(), label: name.toUpperCase() })}
                placeholder="Touring, Performance, Highway…"
              />
              <p className="mt-1 text-xs text-zinc-400">The primary tyre classification</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Season</label>
              <CreatableCombobox
                options={SEASON_TYPES.map(s => ({ value: s.value, label: s.label }))}
                value={seasonType}
                onChange={v => setValue('seasonType', v)}
                placeholder="Summer, winter, all season…"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
            <p className="text-xs text-zinc-400 mb-2">Category this tyre belongs to</p>
            <CreatableMultiCombobox
              options={categories.map(cat => ({ value: cat.category_id, label: cat.category_name }))}
              value={selectedCats}
              onChange={v => setValue('categoryIds', v)}
              placeholder="Select categories…"
            />
          </div>

          {applicationType === 'TBR' && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Position Category</label>
                <select {...register('positionCategory')} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
                  <option value="">Select position</option>
                  <option value="steer">Steer</option>
                  <option value="drive">Drive</option>
                  <option value="trailer">Trailer</option>
                  <option value="all_position">All Position</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Shoulder Type</label>
                <select {...register('shoulderType')} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
                  <option value="">Select shoulder</option>
                  <option value="open_shoulder">Open Shoulder</option>
                  <option value="closed_shoulder">Closed Shoulder</option>
                  <option value="block_drive">Block Drive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Terrain Type</label>
                <input {...register('terrainType')} placeholder="e.g. highway, mixed" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Warranty (km)</label>
              <input type="number" {...register('warrantyKm', { valueAsNumber: true })} placeholder="80000" min={0} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 mb-2">Tags</label>
            <TagInput value={selectedTags} onChange={v => setValue('tags', v)} suggestions={COMMON_TAGS} />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 5 · TYRE SPECS
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading>Tyre Specs</SectionHeading>
          <div className="space-y-5">

            <SectionCard
              title="Product Identification"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <div>
                  <label className={labelCls}>Tyre Size <span className="text-red-500 normal-case">*</span></label>
                  <input {...register(`variants.${IDX}.tyreSizeDisplay`)} onBlur={e => handleSizeBlur(e.target.value)} placeholder="225/45R17" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>SKU <span className="text-red-500 normal-case">*</span></label>
                  <input {...register(`variants.${IDX}.sku`)} placeholder="MB-501" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Barcode (EAN)</label>
                  <input {...register(`variants.${IDX}.barcodeEan`)} placeholder="5902455056767" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Special Size</label>
                  <input {...register(`variants.${IDX}.specialSize`)} placeholder="33X12.50R17" className={inputCls} />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Dimensions"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <div><label className={labelCls}>Width (mm)</label><input type="number" {...register(`variants.${IDX}.width`, { valueAsNumber: true })} placeholder="225" className={inputCls} /></div>
                <div><label className={labelCls}>Aspect Ratio</label><input type="number" {...register(`variants.${IDX}.profile`, { valueAsNumber: true })} placeholder="45" className={inputCls} /></div>
                <div><label className={labelCls}>Rim Size (in) <span className="text-red-500 normal-case">*</span></label><input type="number" {...register(`variants.${IDX}.rimSize`, { valueAsNumber: true })} placeholder="17" className={inputCls} /></div>
                <div><label className={labelCls}>Country of Origin <span className="text-red-500 normal-case">*</span></label><input {...register(`variants.${IDX}.countryOfOrigin`)} placeholder="CN" maxLength={3} className={`${inputCls} uppercase`} /></div>
              </div>
            </SectionCard>

            <SectionCard
              title="Technical Specifications"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
                <div><label className={labelCls}>Load Index</label><input {...register(`variants.${IDX}.loadIndex`)} placeholder="92" className={inputCls} /></div>
                <div><label className={labelCls}>Speed Rating</label><input {...register(`variants.${IDX}.speedRating`)} placeholder="W" className={inputCls} /></div>
                <div><label className={labelCls}>Load / Speed</label><input {...register(`variants.${IDX}.loadSpeedRating`)} placeholder="92W" className={inputCls} /></div>
                <div>
                  <label className={labelCls}>Construction</label>
                  <select {...register(`variants.${IDX}.constructionType`)} className={selectCls}>
                    <option value="">—</option>
                    <option value="R">R (Radial)</option>
                    <option value="ZR">ZR (Z-Radial)</option>
                    <option value="D">D (Diagonal)</option>
                    <option value="-">- (Cross-ply)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                <div><label className={labelCls}>Ply Rating</label><input {...register(`variants.${IDX}.plyRating`)} placeholder="e.g. 10PR" className={inputCls} /></div>
                <div>
                  <label className={labelCls}>Load Range</label>
                  <select {...register(`variants.${IDX}.loadRange`)} className={selectCls}>
                    <option value="">N/A</option>
                    {(['B','C','D','E','F','G'] as const).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sidewall</label>
                  <select {...register(`variants.${IDX}.sidewall`)} className={selectCls}>
                    <option value="">—</option>
                    <option value="BSW">BSW (Black)</option>
                    <option value="OWL">OWL (Outlined White Letters)</option>
                    <option value="RWL">RWL (Raised White Letters)</option>
                    <option value="WSW">WSW (White Sidewall)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-zinc-100">
                {([
                  { field: 'xlReinforced' as const, label: 'XL / Reinforced' },
                  { field: 'runflat'      as const, label: 'Runflat' },
                  { field: 'ltSizing'    as const, label: 'LT (Light Truck)' },
                ]).map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <input type="checkbox" {...register(`variants.${IDX}.${field}`)} className="h-4 w-4 rounded border-zinc-300 accent-primary cursor-pointer" />
                    <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">{label}</span>
                  </label>
                ))}
                <div className="ml-auto w-48">
                  <label className={labelCls}>Tube Type</label>
                  <select {...register(`variants.${IDX}.tubeType`)} className={selectCls}>
                    <option value="">—</option>
                    <option value="tubeless">Tubeless</option>
                    <option value="tube_type">Tube Type</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Physical Specifications"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97z" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
                <div><label className={labelCls}>Section Width (mm)</label><input type="number" {...register(`variants.${IDX}.sectionWidth`, { valueAsNumber: true })} className={inputCls} /></div>
                <div><label className={labelCls}>Tread Depth (mm)</label><input type="number" {...register(`variants.${IDX}.treadDepth`, { valueAsNumber: true })} className={inputCls} /></div>
                <div><label className={labelCls}>Weight (kg)</label><input type="number" {...register(`variants.${IDX}.tyreWeight`, { valueAsNumber: true })} className={inputCls} /></div>
                <div><label className={labelCls}>Overall Dia. (mm)</label><input type="number" {...register(`variants.${IDX}.overallDiameter`, { valueAsNumber: true })} className={inputCls} /></div>
                <div><label className={labelCls}>Max Load</label><input {...register(`variants.${IDX}.maxLoad`)} placeholder="750kg" className={inputCls} /></div>
                <div><label className={labelCls}>Max Pressure</label><input {...register(`variants.${IDX}.maxPressure`)} placeholder="51psi" className={inputCls} /></div>
              </div>
            </SectionCard>

            <SectionCard
              title="Manufacturing"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div><label className={labelCls}>Manufacturer Name</label><input {...register(`variants.${IDX}.manufacturerName`)} className={inputCls} /></div>
                <div><label className={labelCls}>Factory Name</label><input {...register(`variants.${IDX}.factoryName`)} className={inputCls} /></div>
                <div><label className={labelCls}>Factory Country</label><input {...register(`variants.${IDX}.factoryCountry`)} placeholder="CN" maxLength={3} className={`${inputCls} uppercase`} /></div>
              </div>
            </SectionCard>

            <SectionCard
              title="Compliance & Ratings"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <div><label className={labelCls}>Fuel Rating</label><input {...register(`variants.${IDX}.fuelRating`)} placeholder="C" className={inputCls} /></div>
                <div><label className={labelCls}>Wet Grip</label><input {...register(`variants.${IDX}.wetGrip`)} placeholder="A" className={inputCls} /></div>
                <div><label className={labelCls}>Noise (dB)</label><input {...register(`variants.${IDX}.noiseDb`)} placeholder="72dB" className={inputCls} /></div>
                <div><label className={labelCls}>Noise Class</label><input {...register(`variants.${IDX}.noiseClass`)} placeholder="A" className={inputCls} /></div>
                <div><label className={labelCls}>E-Mark</label><input {...register(`variants.${IDX}.eMark`)} placeholder="E4 123456" className={inputCls} /></div>
                <div><label className={labelCls}>DOT Code</label><input {...register(`variants.${IDX}.dotCode`)} placeholder="XXXX XXX 2024" className={inputCls} /></div>
                <div><label className={labelCls}>UTQG</label><input {...register(`variants.${IDX}.utqg`)} placeholder="500 A A" className={inputCls} /></div>
              </div>
            </SectionCard>

            <SectionCard
              title="SKU Status"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Status</label>
                  <select {...register(`variants.${IDX}.status`)} className={selectCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Replacement Product ID <span className="normal-case font-normal text-zinc-400">(if discontinued)</span></label>
                  <input {...register(`variants.${IDX}.replacementProductId`)} placeholder="UUID of replacement SKU" className={inputCls} />
                </div>
              </div>
            </SectionCard>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 6 · PRICING & INVENTORY
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeading>Pricing &amp; Inventory</SectionHeading>

          {variants.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center border border-dashed border-zinc-200 rounded-lg">
              Add tyre specs above before setting pricing.
            </p>
          ) : (
            <>
              <div className="border border-zinc-200 rounded-xl overflow-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 sticky top-0 z-10">
                      {['Tire Size', 'SKU', 'Price (inc. GST) *', 'Compare at', 'Cost', 'Margin', 'Inventory', 'Low Stock Alert'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap bg-zinc-50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {variants.map((variant, index) => {
                      const p          = pricing[index]
                      const price      = p?.priceIncGst ?? 0
                      const cost       = p?.costPrice ?? 0
                      const margin     = calcMargin(price, cost)
                      const marginVal  = parseFloat(margin)
                      const isGood     = margin !== '—' && marginVal > 0
                      const isNegative = margin !== '—' && marginVal < 0
                      return (
                        <tr key={index} className="odd:bg-white even:bg-zinc-50">
                          <td className="px-4 py-3 font-medium text-zinc-800">
                            {variant.tyreSizeDisplay || <span className="text-xs text-zinc-300 italic">Set in Tyre Specs</span>}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 text-xs">
                            {variant.sku || <span className="text-zinc-300 italic">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-400 text-xs">$</span>
                              <input type="number" step="0.01" min="0" {...register(`pricing.${index}.priceIncGst`, { valueAsNumber: true })} className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0.00" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-400 text-xs">$</span>
                              <input type="number" step="0.01" min="0" {...register(`pricing.${index}.compareAtPrice`, { valueAsNumber: true })} className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0.00" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-400 text-xs">$</span>
                              <input type="number" step="0.01" min="0" {...register(`pricing.${index}.costPrice`, { valueAsNumber: true })} className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0.00" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${isGood ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-zinc-400'}`}>{margin}</span>
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" min="0" {...register(`pricing.${index}.inventory`, { valueAsNumber: true })} className="w-20 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" min="0" {...register(`pricing.${index}.lowStockAlert`, { valueAsNumber: true })} className="w-16 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="10" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 7 · FAQ LIST
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
            <h2 className="text-base font-semibold text-zinc-900">FAQ List</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => appendFaq({ question: '', answer: '' })}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add FAQ
            </Button>
          </div>

          {faqFields.length === 0 && (
            <p className="text-sm text-zinc-400 py-4 text-center border border-dashed border-zinc-200 rounded-lg">
              No FAQs added yet. Click "Add FAQ" to create one.
            </p>
          )}

          <div className="space-y-3">
            {faqFields.map((field, index) => (
              <div key={field.id} className="border border-zinc-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border-b border-zinc-200">
                  <svg className="w-4 h-4 text-zinc-400 cursor-move" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zM8 16h2v2H8v-2zm6 0h2v2h-2v-2z" />
                  </svg>
                  <span className="text-xs text-zinc-500">FAQ {index + 1}</span>
                </div>
                <div className="p-3 space-y-2">
                  <Input {...register(`faqList.${index}.question`)} placeholder="Question" />
                  <div className="flex gap-2">
                    <Textarea {...register(`faqList.${index}.answer`)} placeholder="Answer" rows={2} className="flex-1 resize-none" />
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeFaq(index)} className="self-start text-red-400 hover:text-red-600 hover:bg-red-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Sticky footer */}
      <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-zinc-200 bg-white sticky bottom-0 z-10">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={submitting} onClick={onSave}>
          {submitting ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

    </div>
  )
}
