'use client'

import { useCallback, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VehicleFormPanel } from './VehicleFormPanel'
import { Plus } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { AdminVehicle, AdminVehicleDetail } from '@/types/admin.types'

const API   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const LIMIT = 50

type Props = {
  vehicles: AdminVehicle[]
  makes:    string[]
  total:    number
  page:     number
  search:   string
  make:     string
}

export default function VehiclesClient({ vehicles, makes, total, page, search, make }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminVehicleDetail | null>(null)
  const [deleting, setDeleting]         = useState(false)

  function refresh() {
    router.refresh()
  }

  const totalPages = Math.ceil(total / LIMIT)

  const buildHref = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams({ search, make, page: String(page) })
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `${pathname}?${p}`
  }, [search, make, page, pathname])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API}/api/admin/vehicles/${deleteTarget.vehicle_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `HTTP ${res.status}`)
      }
      toastSuccess('Vehicle deleted')
      if (selectedId === deleteTarget.vehicle_id) {
        setSelectedId(null)
      }
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete vehicle')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb crumbs={[{ label: 'Vehicles' }]} />

      <SplitView
        title="Vehicle Database"
        description="Vehicle fitment profiles for tyre & wheel matching"
        panelWidthClassName="w-full lg:w-[460px] xl:w-[500px]"
        headerAction={
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Vehicle
          </button>
        }
        list={
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-60 text-xs"
                placeholder="Search make, model, variant…"
                defaultValue={search}
                onKeyDown={e => {
                  if (e.key === 'Enter') router.push(buildHref({ search: (e.target as HTMLInputElement).value, page: '1' }))
                }}
              />
              <select
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-colors cursor-pointer"
                value={make}
                onChange={e => router.push(buildHref({ make: e.target.value, page: '1' }))}
              >
                <option value="">All Makes</option>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Make</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Series / Variant</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Years</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Body Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-400">
                          No vehicles found.
                        </td>
                      </tr>
                    ) : (
                      vehicles.map(v => {
                        const isSelected = selectedId === v.vehicle_id
                        const seriesVariant = [v.series, v.variant].filter(Boolean).join(' — ') || '—'
                        return (
                          <tr
                            key={v.vehicle_id}
                            className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                              isSelected ? '!bg-primary/10' : ''
                            }`}
                            onClick={() => setSelectedId(v.vehicle_id)}
                          >
                            <td className="px-4 py-3 font-semibold text-zinc-900 whitespace-nowrap">{v.make}</td>
                            <td className="px-4 py-3 text-zinc-800 font-medium whitespace-nowrap">{v.model}</td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap max-w-[160px] truncate" title={seriesVariant}>
                              {seriesVariant}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-xs font-medium whitespace-nowrap">
                              {v.year_from}{v.year_to ? `–${v.year_to}` : '+'}
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{v.body_type ?? '—'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 text-xs text-zinc-500 bg-white">
                  <span>Page {page} of {totalPages} ({total} vehicles)</span>
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
          <VehicleFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            vehicleId={selectedId ?? undefined}
            onSaved={refresh}
            onRequestDelete={v => setDeleteTarget(v)}
          />
        }
      />

      {/* Delete confirmation modal */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Vehicle?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            Delete <strong>{deleteTarget?.make} {deleteTarget?.model}</strong>? All fitments will also be deleted.
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
