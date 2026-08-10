'use client'

import { useCallback, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { VehicleAddSheet } from './VehicleAddSheet'
import { VehicleEditSheet } from './VehicleEditSheet'
import type { AdminVehicle } from '@/types/admin.types'

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

  const [addOpen,      setAddOpen]      = useState(false)
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null)

  function refresh() {
    setAddOpen(false)
    setEditVehicleId(null)
    router.refresh()
  }

  const totalPages = Math.ceil(total / LIMIT)

  const buildHref = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams({ search, make, page: String(page) })
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `${pathname}?${p}`
  }, [search, make, page, pathname])

  return (
    <div className="p-4 sm:p-6">
      <AdminBreadcrumb crumbs={[{ label: 'Vehicles' }]} />

      <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Vehicle Database</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} vehicle{total !== 1 ? 's' : ''}</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Vehicle
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          className="w-60"
          placeholder="Search make, model, variant…"
          defaultValue={search}
          onKeyDown={e => {
            if (e.key === 'Enter') router.push(buildHref({ search: (e.target as HTMLInputElement).value, page: '1' }))
          }}
        />
        <select
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          value={make}
          onChange={e => router.push(buildHref({ make: e.target.value, page: '1' }))}
        >
          <option value="">All Makes</option>
          {makes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      {vehicles.length === 0 ? (
        <div className="mt-12 text-center text-sm text-zinc-400">No vehicles found.</div>
      ) : (
        <div className="mt-6 rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Make</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Model</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Series / Variant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Years</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Body Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {vehicles.map(v => (
                <tr
                  key={v.vehicle_id}
                  className="odd:bg-white even:bg-zinc-50 hover:bg-zinc-200! transition-colors cursor-pointer"
                  onClick={() => setEditVehicleId(v.vehicle_id)}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900">{v.make}</td>
                  <td className="px-4 py-3 text-zinc-800">{v.model}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {[v.series, v.variant].filter(Boolean).join(' — ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {v.year_from}{v.year_to ? `–${v.year_to}` : '+'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{v.body_type ?? '—'}</td>
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

      <VehicleAddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refresh}
      />

      <VehicleEditSheet
        vehicleId={editVehicleId}
        open={!!editVehicleId}
        onClose={() => setEditVehicleId(null)}
        onSaved={refresh}
      />
    </div>
  )
}
