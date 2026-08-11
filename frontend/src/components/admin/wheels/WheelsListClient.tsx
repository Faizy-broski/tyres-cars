'use client'

import { useCallback, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WheelFormPanel } from './WheelFormPanel'
import { Plus, ImageOff } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { AdminWheel, AdminWheelDetail, WheelBrand } from '@/types/admin.types'

const API   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
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

  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminWheelDetail | null>(null)
  const [deleting, setDeleting]         = useState(false)

  function refresh() {
    router.refresh()
  }

  const totalPages = Math.ceil(total / LIMIT)

  const buildHref = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams({ search, brandId, page: String(page) })
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `${pathname}?${p}`
  }, [search, brandId, page, pathname])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API}/api/admin/wheels/${deleteTarget.wheel_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `HTTP ${res.status}`)
      }
      toastSuccess('Wheel deleted')
      if (selectedId === deleteTarget.wheel_id) {
        setSelectedId(null)
      }
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete wheel')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb crumbs={[{ label: 'Wheels' }]} />

      <SplitView
        title="Wheels"
        description="Manage wheel models, finishes, and fitment variants"
        panelWidthClassName="w-full lg:w-[440px] xl:w-[480px]"
        headerAction={
          <>
            <Link href="/admin/wheels/brands">
              <Button variant="outline" size="sm">Manage Brands</Button>
            </Link>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Add Wheel
            </button>
          </>
        }
        list={
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-60 text-xs"
                placeholder="Search model name…"
                defaultValue={search}
                onKeyDown={e => {
                  if (e.key === 'Enter') router.push(buildHref({ search: (e.target as HTMLInputElement).value, page: '1' }))
                }}
              />
              <select
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-colors cursor-pointer"
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
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Brand</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Style</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Finish / Colour</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Variants</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {wheels.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">
                          No wheels found.
                        </td>
                      </tr>
                    ) : (
                      wheels.map(w => {
                        const isSelected = selectedId === w.wheel_id
                        const finishText = [w.finish, w.colour].filter(Boolean).join(' / ') || '—'
                        return (
                          <tr
                            key={w.wheel_id}
                            className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                              isSelected ? '!bg-primary/10' : ''
                            }`}
                            onClick={() => setSelectedId(w.wheel_id)}
                          >
                            <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {w.main_image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={w.main_image}
                                    alt={w.model_name}
                                    className="h-9 w-9 object-contain rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 shrink-0"
                                  />
                                ) : (
                                  <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 shrink-0">
                                    <ImageOff className="h-4 w-4 text-zinc-300" />
                                  </div>
                                )}
                                <div className="min-w-0 max-w-[160px]">
                                  <div className="font-semibold text-zinc-900 truncate" title={w.model_name}>
                                    {w.model_name}
                                  </div>
                                  <div className="text-xs text-zinc-400 font-mono truncate" title={w.model_slug}>
                                    {w.model_slug}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-700 font-medium whitespace-nowrap">
                              {w.wheel_brands?.brand_name ?? '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {w.style_category ? (
                                <Badge className={STYLE_COLOURS[w.style_category] ?? 'bg-zinc-100 text-zinc-600'}>
                                  {w.style_category}
                                </Badge>
                              ) : <span className="text-zinc-400 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap max-w-[130px] truncate" title={finishText}>
                              {finishText}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-700 font-semibold tabular-nums whitespace-nowrap">
                              {w.variant_count}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge className={w.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                                {w.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 text-xs text-zinc-500 bg-white">
                  <span>Page {page} of {totalPages} ({total} models)</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => router.push(buildHref({ page: String(page - 1) }))}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 font-medium text-zinc-700">{page} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => router.push(buildHref({ page: String(page + 1) }))}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        panel={
          <WheelFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            wheelId={selectedId ?? undefined}
            brands={brands}
            onSaved={refresh}
            onRequestDelete={w => setDeleteTarget(w)}
          />
        }
      />

      {/* Delete confirmation modal */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Wheel?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            Delete <strong>{deleteTarget?.model_name}</strong>? This fails if variants or orders exist.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
