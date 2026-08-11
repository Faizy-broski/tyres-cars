'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { toastError } from '@/lib/toast'
import { Pencil, Plus, ChevronRight, ImageOff } from 'lucide-react'
import type { Brand } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const POSITIONING_COLOURS: Record<string, string> = {
  budget:     'bg-zinc-100 text-zinc-600',
  mid_range:  'bg-blue-50 text-blue-700',
  premium:    'bg-amber-50 text-amber-700',
  commercial: 'bg-purple-50 text-purple-700',
}

interface Pattern {
  pattern_id:       string
  pattern_name:     string
  pattern_slug:     string
  application_type: string | null
  season_type:      string | null
  is_active:        boolean
  show_on_website:  boolean
  main_image:       string | null
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/60">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-zinc-800 whitespace-pre-line">{value}</p>
    </div>
  )
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
      <span className="text-sm text-zinc-700">{label}</span>
      <Badge className={`text-xs rounded-full border-0 ${active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
        {active ? 'Yes' : 'No'}
      </Badge>
    </div>
  )
}

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [brand,    setBrand]    = useState<Brand | null>(null)
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading,  setLoading]  = useState(true)
  const [pLoading, setPLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        const res = await fetch(`${API}/api/admin/products/brands/all`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) throw new Error('Failed to load brands')
        const json = await res.json()
        const brands: Brand[] = Array.isArray(json) ? json : (json.data ?? json.brands ?? [])
        const b = brands.find(x => x.brand_id === id)
        if (!b) throw new Error('Brand not found')
        setBrand(b)
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load brand')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    async function loadPatterns() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        const res = await fetch(`${API}/api/admin/products/brands/${id}/patterns`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) throw new Error('Failed to load patterns')
        const json = await res.json()
        setPatterns(Array.isArray(json) ? json : (json.data ?? json.patterns ?? []))
      } catch {
        // non-fatal — panel shows empty state
      } finally {
        setPLoading(false)
      }
    }
    loadPatterns()
  }, [id])

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-6xl">
        {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-zinc-100 animate-pulse" />)}
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl">
        <p className="text-sm text-zinc-500">Brand not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-6">
      <AdminBreadcrumb crumbs={[
        { label: 'Products', href: '/admin/products' },
        { label: 'Brands',   href: '/admin/products/brands' },
        { label: brand.brand_name },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {brand.brand_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.brand_logo} alt="" className="h-16 w-16 object-contain rounded-xl border border-zinc-200 bg-zinc-50 p-1 shrink-0" />
          ) : (
            <div className="h-16 w-16 rounded-xl border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 text-lg font-bold shrink-0">
              {brand.brand_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{brand.brand_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-zinc-400 font-mono">/{brand.brand_slug}</span>
              {brand.brand_positioning && (
                <Badge className={`text-xs rounded-full border-0 capitalize ${POSITIONING_COLOURS[brand.brand_positioning] ?? 'bg-zinc-100 text-zinc-600'}`}>
                  {brand.brand_positioning.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Link
          href={`/admin/products/brands?brand=${id}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm shrink-0"
        >
          <Pencil className="w-4 h-4" /> Edit Brand
        </Link>
      </div>

      {/* Banner */}
      {brand.brand_banner_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.brand_banner_image} alt="Banner" className="w-full h-40 object-cover rounded-2xl border border-zinc-200" />
      )}

      {/* Two-column: brand detail + patterns panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

        {/* Left — brand sections */}
        <div className="space-y-6">
          <Section title="General">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Country of Brand"   value={brand.country_of_brand} />
              <Field label="Manufacturer"       value={brand.manufacturer_name} />
              <Field label="Short Description"  value={brand.brand_short_description} />
            </div>
            {brand.brand_description && (
              <div className="mt-5">
                <Field label="Full Description" value={brand.brand_description} />
              </div>
            )}
            {brand.warranty_info && (
              <div className="mt-5">
                <Field label="Warranty Information" value={brand.warranty_info} />
              </div>
            )}
          </Section>

          {(brand.seo_title || brand.seo_description) && (
            <Section title="SEO">
              <div className="space-y-4">
                <Field label="SEO Title"       value={brand.seo_title} />
                <Field label="SEO Description" value={brand.seo_description} />
              </div>
            </Section>
          )}

          <Section title="Visibility">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Flag label="Is Active"       active={brand.is_active} />
              <Flag label="Show on Website" active={brand.show_on_website} />
            </div>
          </Section>

          <Section title="Channel Permissions">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Flag label="Wholesale"    active={brand.channel_wholesale} />
              <Flag label="Retail"       active={brand.channel_retail} />
              <Flag label="Marketplaces" active={brand.channel_marketplaces} />
            </div>
          </Section>
        </div>

        {/* Right — patterns panel */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden sticky top-6">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">Patterns</h2>
              {!pLoading && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-zinc-200 text-zinc-600 text-[10px] font-bold">
                  {patterns.length}
                </span>
              )}
            </div>
            <Link
              href={`/admin/products/patterns?brand=${id}`}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </Link>
          </div>

          {pLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-zinc-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-2.5 w-20 bg-zinc-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : patterns.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ImageOff className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-500">No patterns yet</p>
              <p className="text-xs text-zinc-400 mt-1">Add the first pattern for this brand.</p>
              <Link
                href={`/admin/products/patterns?brand=${id}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Pattern
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
              {patterns.map(p => (
                <li key={p.pattern_id}>
                  <Link
                    href={`/admin/products/brands/${id}/patterns/${p.pattern_id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <div className="h-10 w-10 rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.main_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.main_image} alt="" className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-400">
                          {p.pattern_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{p.pattern_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {p.application_type && (
                          <span className="text-[10px] text-zinc-500 capitalize">{p.application_type.replace('_', ' ')}</span>
                        )}
                        {p.season_type && (
                          <span className="text-[10px] text-zinc-400">· {p.season_type}</span>
                        )}
                      </div>
                    </div>

                    {/* Status badges + arrow */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-400'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
