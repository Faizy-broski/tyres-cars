'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import type { AdminWheel, WheelBrand } from '@/types/admin.types'

const LIMIT = 20

const STYLE_COLOURS: Record<string, string> = {
  '4x4':       'bg-orange-50 text-orange-700',
  street:      'bg-blue-50 text-blue-700',
  luxury:      'bg-amber-50 text-amber-700',
  commercial:  'bg-purple-50 text-purple-700',
}

type Props = {
  wheels:  AdminWheel[]
  brands:  WheelBrand[]
  total:   number
  page:    number
  search:  string
  brandId: string
}

export default function WheelsListClient({ wheels, brands, total, page, search, brandId }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const totalPages = Math.ceil(total / LIMIT)

  const buildHref = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams({ search, brandId, page: String(page) })
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `${pathname}?${p}`
  }, [search, brandId, page, pathname])

  return (
    <div className="p-4 sm:p-6">
      <AdminBreadcrumb crumbs={[{ label: 'Wheels' }]} />

      <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Wheels</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} model{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/wheels/brands">
            <Button variant="outline" size="sm">Manage Brands</Button>
          </Link>
          <Link href="/admin/wheels/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Wheel
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          className="w-60"
          placeholder="Search model name…"
          defaultValue={search}
          onKeyDown={e => {
            if (e.key === 'Enter') router.push(buildHref({ search: (e.target as HTMLInputElement).value, page: '1' }))
          }}
        />
        <select
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          value={brandId}
          onChange={e => router.push(buildHref({ brandId: e.target.value, page: '1' }))}
        >
          <option value="">All Brands</option>
          {brands.map(b => (
            <option key={b.wheel_brand_id} value={b.wheel_brand_id}>{b.brand_name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {wheels.length === 0 ? (
        <div className="mt-12 text-center text-sm text-zinc-400">No wheels found.</div>
      ) : (
        <div className="mt-6 rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Model</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Style</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Finish / Colour</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variants</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {wheels.map(w => (
                <tr key={w.wheel_id} className="odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer" onClick={() => router.push(`/admin/wheels/${w.wheel_id}`)}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <div className="flex items-center gap-3">
                      {w.main_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.main_image} alt={w.model_name} className="h-10 w-10 object-contain rounded border border-zinc-100" />
                      ) : (
                        <div className="h-10 w-10 flex items-center justify-center rounded border border-zinc-100 bg-zinc-50 shrink-0">
                          <ImageOff className="h-4 w-4 text-zinc-300" />
                        </div>
                      )}
                      <div>
                        <div>{w.model_name}</div>
                        <div className="text-xs text-zinc-400">{w.model_slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{w.wheel_brands?.brand_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {w.style_category ? (
                      <Badge className={STYLE_COLOURS[w.style_category] ?? 'bg-zinc-100 text-zinc-600'}>
                        {w.style_category}
                      </Badge>
                    ) : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {[w.finish, w.colour].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 font-medium">{w.variant_count}</td>
                  <td className="px-4 py-3">
                    <Badge className={w.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1 bg-primary text-zinc-900 hover:bg-primary/90" disabled={page <= 1} onClick={() => router.push(buildHref({ page: String(page - 1) }))}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button size="sm" className="gap-1 bg-primary text-zinc-900 hover:bg-primary/90" disabled={page >= totalPages} onClick={() => router.push(buildHref({ page: String(page + 1) }))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
