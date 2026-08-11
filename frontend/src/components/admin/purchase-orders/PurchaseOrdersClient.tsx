'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PurchaseOrderFormPanel } from './PurchaseOrderFormPanel'
import { Plus } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { PurchaseOrderListItem, PoStatus } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-zinc-100 text-zinc-600',
  ordered:   'bg-blue-50 text-blue-700',
  shipped:   'bg-amber-50 text-amber-700',
  arrived:   'bg-purple-50 text-purple-700',
  received:  'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

function fmt(n: number | null | undefined, cur = 'AUD') {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Props = {
  pos:        PurchaseOrderListItem[]
  total:      number
  totalPages: number
  page:       number
  status:     string
}

export default function PurchaseOrdersClient({
  pos,
  total,
  totalPages,
  page,
  status,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [selectedPo, setSelectedPo]     = useState<PurchaseOrderListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderListItem | null>(null)
  const [deleting, setDeleting]         = useState(false)

  function selectPo(po: PurchaseOrderListItem) {
    setSelectedId(po.po_id)
    setSelectedPo(po)
  }

  function handleNewPo() {
    setSelectedId(null)
    setSelectedPo(null)
  }

  function handleSaved(saved: { po_id: string; po_number?: string }) {
    router.refresh()
    setSelectedId(saved.po_id)
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
      const res = await fetch(`${API}/api/admin/purchase-orders/${deleteTarget.po_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Delete failed')
      }
      toastSuccess('Purchase order deleted')
      if (selectedId === deleteTarget.po_id) {
        setSelectedId(null)
        setSelectedPo(null)
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
      <AdminBreadcrumb crumbs={[{ label: 'Purchase Orders' }]} />

      <SplitView
        title="Purchase Orders"
        description="Manage stock procurement and inbound supplier orders"
        panelWidthClassName="w-full lg:w-[480px] xl:w-[540px]"
        headerAction={
          <button
            type="button"
            onClick={handleNewPo}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Purchase Order
          </button>
        }
        list={
          <div className="space-y-4">
            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              {(['', 'draft', 'ordered', 'shipped', 'arrived', 'received', 'cancelled'] as const).map(s => (
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
                  {s || 'All Orders'}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">PO Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Warehouse</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Order Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">ETA</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Items</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {pos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-zinc-400 text-sm">
                          No purchase orders found
                        </td>
                      </tr>
                    ) : (
                      pos.map(po => {
                        const isSelected = selectedId === po.po_id
                        return (
                          <tr
                            key={po.po_id}
                            className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                              isSelected ? '!bg-primary/10' : ''
                            }`}
                            onClick={() => selectPo(po)}
                          >
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-900 whitespace-nowrap">
                              {po.po_number}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 font-medium whitespace-nowrap max-w-[140px] truncate" title={po.suppliers?.supplier_name ?? ''}>
                              {po.suppliers?.supplier_name ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap max-w-[120px] truncate" title={po.warehouses?.warehouse_name ?? ''}>
                              {po.warehouses?.warehouse_name ?? '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${STATUS_STYLE[po.po_status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                {po.po_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtDate(po.order_date)}</td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtDate(po.eta_date)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-zinc-700 whitespace-nowrap">
                              {po.purchase_order_items?.length ?? 0}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-900 whitespace-nowrap">
                              {fmt(po.total_cost, po.currency)}
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
                  <span>{total} total orders</span>
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
          <PurchaseOrderFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            poId={selectedId ?? undefined}
            initialPo={selectedPo}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const target = pos.find(p => p.po_id === selectedId) ?? selectedPo
              if (target) setDeleteTarget(target)
            }}
          />
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Purchase Order?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            Delete <strong>{deleteTarget?.po_number}</strong>? Only draft orders can be deleted.
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
