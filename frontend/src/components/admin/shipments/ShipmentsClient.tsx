'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ShipmentFormPanel } from './ShipmentFormPanel'
import { Plus } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { ShipmentListItem, ShipmentStatus } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STATUS_STYLE: Record<string, string> = {
  planned:    'bg-zinc-100 text-zinc-600',
  in_transit: 'bg-blue-50 text-blue-700',
  customs:    'bg-amber-50 text-amber-700',
  delivered:  'bg-green-50 text-green-700',
  cancelled:  'bg-red-50 text-red-700',
}

const CLEARANCE_STYLE: Record<string, string> = {
  pending:   'bg-zinc-100 text-zinc-600',
  submitted: 'bg-blue-50 text-blue-700',
  cleared:   'bg-green-50 text-green-700',
  held:      'bg-red-50 text-red-700',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Props = {
  shipments:  ShipmentListItem[]
  total:      number
  totalPages: number
  page:       number
  status:     string
}

export default function ShipmentsClient({
  shipments,
  total,
  totalPages,
  page,
  status,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<ShipmentListItem | null>(null)
  const [deleteTarget, setDeleteTarget]     = useState<ShipmentListItem | null>(null)
  const [deleting, setDeleting]             = useState(false)

  function selectShipment(s: ShipmentListItem) {
    setSelectedId(s.shipment_id)
    setSelectedShipment(s)
  }

  function handleNewShipment() {
    setSelectedId(null)
    setSelectedShipment(null)
  }

  function handleSaved() {
    router.refresh()
  }

  function navTo(st: string, pg = 1) {
    const p = new URLSearchParams()
    if (st) p.set('status', st)
    if (pg > 1) p.set('page', String(pg))
    const q = p.toString()
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API}/api/admin/shipments/${deleteTarget.shipment_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Delete failed')
      }
      toastSuccess('Shipment deleted')
      if (selectedId === deleteTarget.shipment_id) {
        setSelectedId(null)
        setSelectedShipment(null)
      }
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb crumbs={[{ label: 'Shipments' }]} />

      <SplitView
        title="Inbound Shipments"
        description="Track sea/air containers and port clearance status"
        panelWidthClassName="w-full lg:w-[480px] xl:w-[540px]"
        headerAction={
          <button
            type="button"
            onClick={handleNewShipment}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Shipment
          </button>
        }
        list={
          <div className="space-y-4">
            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              {(['', 'planned', 'in_transit', 'customs', 'delivered', 'cancelled'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => navTo(s, 1)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
                    status === s
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {s ? s.replace('_', ' ') : 'All Shipments'}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Container #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Linked PO</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Warehouse</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Vessel</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">ETD / ETA</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Clearance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {shipments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-zinc-400 text-sm">
                          No shipments found
                        </td>
                      </tr>
                    ) : (
                      shipments.map(s => {
                        const isSelected = selectedId === s.shipment_id
                        return (
                          <tr
                            key={s.shipment_id}
                            className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                              isSelected ? '!bg-primary/10' : ''
                            }`}
                            onClick={() => selectShipment(s)}
                          >
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-900 whitespace-nowrap">
                              {s.container_number || '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-zinc-600 whitespace-nowrap">
                              {s.purchase_orders?.po_number ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap max-w-[130px] truncate" title={s.warehouses?.warehouse_name ?? ''}>
                              {s.warehouses?.warehouse_name ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 text-xs whitespace-nowrap max-w-[130px] truncate" title={s.vessel_name ?? ''}>
                              {s.vessel_name || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${STATUS_STYLE[s.shipment_status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                {s.shipment_status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                              <div>{fmtDate(s.etd)} → {fmtDate(s.eta)}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {s.clearance_status ? (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CLEARANCE_STYLE[s.clearance_status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                  {s.clearance_status}
                                </span>
                              ) : <span className="text-zinc-400 text-xs">—</span>}
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
                  <span>{total} total shipments</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => navTo(status, page - 1)}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 font-medium text-zinc-700">{page} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => navTo(status, page + 1)}
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
          <ShipmentFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            shipmentId={selectedId ?? undefined}
            initialShipment={selectedShipment}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const target = shipments.find(s => s.shipment_id === selectedId) ?? selectedShipment
              if (target) setDeleteTarget(target)
            }}
          />
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Shipment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            Delete shipment <strong>{deleteTarget?.container_number || deleteTarget?.shipment_id}</strong>? Only planned or cancelled shipments can be deleted.
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
