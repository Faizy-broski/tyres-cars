'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { toastError } from '@/lib/toast'
import { Pencil } from 'lucide-react'
import type { Brand } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pattern = Record<string, any>

const DASH = <span className="text-zinc-300">—</span>

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-zinc-800 whitespace-pre-line">
        {value !== null && value !== undefined && value !== '' ? String(value) : DASH}
      </p>
    </div>
  )
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

export default function ViewPatternPage() {
  const { id, patternId } = useParams<{ id: string; patternId: string }>()
  const [pattern, setPattern]     = useState<Pattern | null>(null)
  const [brandName, setBrandName] = useState('')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const token = session?.access_token ?? ''
        const headers = { Authorization: `Bearer ${token}` }

        const [brandsRes, patternRes] = await Promise.all([
          fetch(`${API}/api/admin/products/brands/all`, { headers }),
          fetch(`${API}/api/admin/products/brands/${id}/patterns/${patternId}`, { headers }),
        ])
        if (!brandsRes.ok || !patternRes.ok) throw new Error('Failed to load')

        const brands: Brand[] = await brandsRes.json()
        const b = brands.find(x => x.brand_id === id)
        if (b) setBrandName(b.brand_name)

        setPattern(await patternRes.json())
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load pattern')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, patternId])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
        {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-zinc-100 animate-pulse" />)}
      </div>
    )
  }

  if (!pattern) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl">
        <p className="text-sm text-zinc-500">Pattern not found.</p>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories: { category_id: string; category_name: string; category_type: string }[] =
    (pattern.pattern_categories ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((pc: any) => pc.categories ?? null)
      .filter(Boolean)

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      <AdminBreadcrumb crumbs={[
        { label: 'Products', href: '/admin/products' },
        { label: 'Brands',   href: '/admin/products/brands' },
        { label: brandName,  href: `/admin/products/brands/${id}` },
        { label: pattern.pattern_name },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {pattern.main_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pattern.main_image} alt="" className="h-16 w-16 object-contain rounded-xl border border-zinc-200 bg-zinc-50 p-1 shrink-0" />
          ) : (
            <div className="h-16 w-16 rounded-xl border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 text-lg font-bold shrink-0">
              {pattern.pattern_name?.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{pattern.pattern_name}</h1>
            <p className="text-sm text-zinc-400 font-mono mt-0.5">/{pattern.pattern_slug}</p>
          </div>
        </div>
        <Link
          href={`/admin/products/patterns?brand=${id}&pattern=${patternId}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm shrink-0"
        >
          <Pencil className="w-4 h-4" /> Edit Pattern
        </Link>
      </div>

      {/* Flags */}
      <Section title="Status & Flags">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Flag label="Active"        active={!!pattern.is_active} />
          <Flag label="On Website"    active={!!pattern.show_on_website} />
          <Flag label="On Sale"       active={!!pattern.on_sale} />
          <Flag label="Discountable"  active={!!pattern.discountable} />
        </div>
      </Section>

      {/* Specifications */}
      <Section title="Specifications">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
          <Field label="Application Type"   value={pattern.application_type} />
          <Field label="Season Type"        value={pattern.season_type?.replace(/_/g, ' ')} />
          <Field label="Performance"        value={pattern.performance_category?.replace(/_/g, ' ')} />
          <Field label="Position Category"  value={pattern.position_category?.replace(/_/g, ' ')} />
          <Field label="Shoulder Type"      value={pattern.shoulder_type?.replace(/_/g, ' ')} />
          <Field label="Terrain Type"       value={pattern.terrain_type?.replace(/_/g, ' ')} />
          <Field label="Country of Origin"  value={pattern.default_country_of_origin} />
          <Field label="Warranty"           value={pattern.warranty_km ? `${Number(pattern.warranty_km).toLocaleString()} km` : null} />
        </div>
      </Section>

      {/* Descriptions */}
      <Section title="Descriptions">
        <div className="space-y-5">
          <Field label="Short Description"  value={pattern.pattern_short_description} />
          <Field label="Full Description"   value={pattern.pattern_description} />
          <Field label="Tyre Overview"      value={pattern.tyre_overview} />
          <Field label="Key Features"       value={pattern.features} />
        </div>
      </Section>

      {/* Warranty */}
      <Section title="Warranty">
        <Field label="Warranty Information" value={pattern.warranty_information} />
      </Section>

      {/* Categories */}
      <Section title="Categories">
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <span key={cat.category_id} className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 capitalize">
                {cat.category_name}
                <span className="ml-1.5 text-zinc-400">· {cat.category_type}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No categories assigned.</p>
        )}
      </Section>

      {/* SEO */}
      <Section title="SEO">
        <div className="space-y-5">
          <Field label="SEO Title"       value={pattern.seo_title} />
          <Field label="SEO Description" value={pattern.seo_description} />
        </div>
      </Section>
    </div>
  )
}
