'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { toastError } from '@/lib/toast'
import PublishToggle from '@/components/admin/products/PublishToggle'
// import { VariantsTableActions, VariantRowMenu } from '@/components/admin/products/ProductActionsBar' // VARIANTS DISABLED
import type { Pattern, SkuListItem } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function Field({ label, value, html }: { label: string; value?: string | number | null; html?: boolean }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">{label}</p>
      {hasValue && html ? (
        <div
          className="text-sm text-zinc-800 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1"
          dangerouslySetInnerHTML={{ __html: String(value) }}
        />
      ) : (
        <p className="text-sm text-zinc-800 whitespace-pre-line">
          {hasValue ? String(value) : <span className="text-zinc-300">—</span>}
        </p>
      )}
    </div>
  )
}

function Flag({ label, active, activeLabel = 'Yes', inactiveLabel = 'No' }: {
  label: string; active: boolean; activeLabel?: string; inactiveLabel?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <Badge className={`text-xs rounded-full border-0 ${active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
        {active ? activeLabel : inactiveLabel}
      </Badge>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-900 pb-3 mb-4 border-b border-zinc-100">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const [pattern, setPattern]       = useState<Pattern | null>(null)
  const [skus, setSkus]             = useState<SkuListItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const onRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    document.title = pattern ? `${pattern.pattern_name} | Tyre Vault` : 'Product | Tyre Vault'
  }, [pattern])

  const t = searchParams.get('t')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        const res = await fetch(`${API}/api/admin/products/${id}`, {
          headers: { Authorization: `Bearer ${tok}` },
          cache: 'no-store',
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${res.status}`)
        }
        const json = await res.json()
        if (!cancelled) {
          setPattern(json.pattern as Pattern)
          setSkus((json.skus ?? []) as SkuListItem[])
        }
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load product')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, refreshKey, t])

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-36 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!pattern) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Products', href: '/admin/products' }, { label: 'Product' }]} />
        <p className="mt-6 text-sm text-zinc-500">Product not found.</p>
      </div>
    )
  }

  const brand      = pattern.brands?.brand_name ?? '—'
  const collection = pattern.collections?.collection_name ?? '—'
  const categories = (pattern.pattern_categories ?? []).map(pc => pc.categories?.category_name).filter(Boolean) as string[]
  const tags       = Array.isArray(pattern.tags) ? pattern.tags as string[] : []
  const images     = Array.isArray(pattern.gallery_images) ? pattern.gallery_images as string[] : []
  const faqs       = Array.isArray(pattern.faq_list) ? pattern.faq_list : []

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Products', href: '/admin/products' },
          { label: pattern.pattern_name },
        ]} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Header */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
              <div className="flex items-center gap-3">
                {pattern.brands?.brand_logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pattern.brands.brand_logo} alt="" className="h-9 w-9 object-contain rounded border border-zinc-200 bg-zinc-50 p-0.5 shrink-0" />
                )}
                <div>
                  <h1 className="text-lg font-semibold text-zinc-900">{pattern.pattern_name}</h1>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">/{pattern.pattern_slug}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  pattern.show_on_website ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${pattern.show_on_website ? 'bg-green-500' : 'bg-zinc-400'}`} />
                  {pattern.show_on_website ? 'Published' : 'Draft'}
                </span>
                <Link
                  href={`/admin/products/${id}/edit`}
                  className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Edit
                </Link>
              </div>
            </div>

            {/* Core specs grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Brand"       value={brand} />
              {/* <Field label="Collection"  value={collection} /> */}
              <Field label="Application" value={pattern.application_type} />
              <Field label="Season"      value={pattern.season_type?.replace(/_/g, ' ')} />
              <Field label="Performance" value={pattern.performance_category?.replace(/_/g, ' ')} />
              <Field label="Position"    value={pattern.position_category?.replace(/_/g, ' ')} />
              <Field label="Shoulder"    value={pattern.shoulder_type?.replace(/_/g, ' ')} />
              <Field label="Terrain"     value={pattern.terrain_type?.replace(/_/g, ' ')} />
              <Field label="Origin"      value={pattern.default_country_of_origin} />
              <Field label="Warranty"    value={pattern.warranty_km ? `${Number(pattern.warranty_km).toLocaleString()} km` : null} />
            </div>
          </div>

          {/* SKU Codes */}
          {skus.length > 0 && (
            <Section title={`SKU Codes (${skus.length} size${skus.length !== 1 ? 's' : ''})`}>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wide pr-4">Size</th>
                      <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wide pr-4">Item Code</th>
                      <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wide pr-4">Helper Code</th>
                      <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wide">Supplier Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {skus.map(sku => {
                      const helperCode = [
                        sku.width   != null ? Math.floor(sku.width)    : '',
                        sku.profile != null ? Math.floor(sku.profile)  : '',
                        sku.rim_size != null ? Math.floor(sku.rim_size) : '',
                      ].join('')
                      const supplierCode = [
                        pattern.brands?.brand_name,
                        sku.tyre_size_display,
                        pattern.pattern_name,
                        sku.load_index,
                        sku.speed_rating?.toUpperCase(),
                      ].filter(Boolean).join(' ')
                      return (
                        <tr key={sku.product_id} className="hover:bg-zinc-50/60">
                          <td className="py-2 pr-4 font-medium text-zinc-700 whitespace-nowrap">{sku.tyre_size_display}</td>
                          <td className="py-2 pr-4 font-mono text-primary whitespace-nowrap">{sku.sku}</td>
                          <td className="py-2 pr-4 font-mono text-zinc-500 whitespace-nowrap">{helperCode || '—'}</td>
                          <td className="py-2 text-zinc-500">{supplierCode || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Descriptions — only shown if at least one field has content */}
          {(pattern.pattern_short_description || pattern.pattern_description || pattern.tyre_overview || pattern.features || pattern.warranty_information) && (
            <Section title="Descriptions">
              {pattern.pattern_short_description && <Field label="Short Description" value={pattern.pattern_short_description} />}
              {pattern.pattern_description        && <Field label="Full Description"  value={pattern.pattern_description} html />}
              {pattern.tyre_overview              && <Field label="Tyre Overview"     value={pattern.tyre_overview} html />}
              {pattern.features                   && <Field label="Key Features"      value={pattern.features} html />}
              {pattern.warranty_information       && <Field label="Warranty Info"     value={pattern.warranty_information} html />}
            </Section>
          )}

          {/* Media */}
          <Section title="Media">
            {images.length > 0 ? (
              <div className="flex gap-3 flex-wrap">
                {images.map((src, i) => (
                  <div key={i} className="w-20 h-20 rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No gallery images uploaded.</p>
            )}
            {pattern.tread_image && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Tread Image</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pattern.tread_image} alt="Tread" className="h-20 rounded-lg border border-zinc-200 object-contain bg-zinc-50" />
              </div>
            )}
            {pattern.tyre_spec_sheet && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Spec Sheet</p>
                <a href={pattern.tyre_spec_sheet} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  View PDF →
                </a>
              </div>
            )}
          </Section>

          {/* SEO */}
          {(pattern.seo_title || pattern.seo_description) && (
            <Section title="SEO">
              <Field label="SEO Title"       value={pattern.seo_title} />
              <Field label="SEO Description" value={pattern.seo_description} />
            </Section>
          )}

          {/* FAQ */}
          {faqs.length > 0 && (
            <Section title={`FAQ (${faqs.length})`}>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                    <p className="text-sm font-medium text-zinc-800 mb-1">{faq.question}</p>
                    <p className="text-sm text-zinc-500">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* VARIANTS DISABLED — section commented out; re-enable by uncommenting below
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="flex flex-col gap-3 px-5 py-4 border-b border-zinc-200 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Variants <span className="text-zinc-400 font-normal ml-1">({skus.length})</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <VariantsTableActions patternId={id} skuStocks={skus as any} skuPrices={skus as any} onSuccess={onRefresh} />
                <Link href={`/admin/products/${id}/variants/new`} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-primary/90 transition-colors">
                  Add variant
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 w-8" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Tire Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Inventory</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {skus.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">No variants yet. Add the first one.</td>
                    </tr>
                  ) : skus.map(sku => {
                    const stockRows     = Array.isArray(sku.product_stock) ? sku.product_stock : []
                    const totalStock    = stockRows.reduce((sum: number, s: { available_stock: number }) => sum + s.available_stock, 0)
                    const locationCount = stockRows.length
                    const isOutOfStock  = totalStock === 0
                    const thumb = Array.isArray((sku as any).variant_images) && (sku as any).variant_images.length > 0
                      ? (sku as any).variant_images[0] as string : null
                    return (
                      <tr key={sku.product_id} className="odd:bg-white even:bg-zinc-50 [&:hover]:bg-amber-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="w-8 h-8 rounded bg-zinc-100 overflow-hidden flex items-center justify-center">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800">
                          <Link href={`/admin/products/${id}/variants/${sku.product_id}`} className="hover:underline">
                            {sku.tyre_size_display}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{sku.sku}</td>
                        <td className="px-4 py-3">
                          <span className={isOutOfStock ? 'text-red-600 text-sm' : 'text-zinc-700 text-sm'}>
                            {isOutOfStock
                              ? `0 in stock · ${locationCount} location${locationCount !== 1 ? 's' : ''}`
                              : `${totalStock} in stock · ${locationCount} location${locationCount !== 1 ? 's' : ''}`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <VariantRowMenu patternId={id} variantId={sku.product_id} variantName={sku.tyre_size_display} onDeleted={onRefresh} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          */}
        </div>

        {/* ── Right sidebar ──────────────────────────────────────── */}
        <div className="w-full space-y-4 lg:w-64 lg:shrink-0">
          <PublishToggle patternId={id} isPublished={pattern.show_on_website ?? false} onSuccess={onRefresh} />

          {/* Visibility flags */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Visibility & Flags</h3>
            <div className="space-y-1.5">
              <Flag label="Active"       active={pattern.is_active}       activeLabel="Active"    inactiveLabel="Inactive" />
              <Flag label="On Website"   active={pattern.show_on_website}  activeLabel="Published" inactiveLabel="Draft" />
              <Flag label="On Sale"      active={pattern.on_sale} />
              <Flag label="Discountable" active={pattern.discountable} />
            </div>
          </div>

          {/* Organize */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Organize</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 shrink-0">Type</dt>
                <dd className="text-zinc-700">{pattern.application_type ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                {/* <dt className="text-zinc-500 shrink-0">Collection</dt>
                <dd className="text-zinc-700 text-right">{collection}</dd> */}
              </div>
              <div>
                <dt className="text-zinc-500 mb-1.5">Categories</dt>
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {categories.map(cat => (
                      <span key={cat} className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{cat}</span>
                    ))}
                  </div>
                ) : <dd className="text-zinc-300 text-xs">None assigned</dd>}
              </div>
              <div>
                <dt className="text-zinc-500 mb-1.5">Tags</dt>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tags.map(tag => (
                      <span key={tag} className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-white">{tag}</span>
                    ))}
                  </div>
                ) : <dd className="text-zinc-300 text-xs">No tags</dd>}
              </div>
            </dl>
          </div>

          {/* Timestamps */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Activity</h3>
            <dl className="space-y-2 text-xs text-zinc-500">
              <div className="flex justify-between">
                <dt>Created</dt>
                <dd>{new Date(pattern.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Last updated</dt>
                <dd>{new Date(pattern.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
