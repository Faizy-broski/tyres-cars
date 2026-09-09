'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PurchaseOrderSheet } from '@/components/admin/purchase-orders/PurchaseOrderSheet'
import { ProductSearchInput } from '@/components/admin/products/ProductSearchInput'
import { toastError, toastSuccess } from '@/lib/toast'
import { Pencil, Trash2, Plus, ChevronDown, Package } from 'lucide-react'
import type { PurchaseOrder, PurchaseOrderItem, PoStatus, ShipmentListItem } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STATUS_FLOW: PoStatus[] = ['draft', 'ordered', 'shipped', 'arrived', 'received', 'cancelled']

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-zinc-100 text-zinc-600',
  ordered:   'bg-blue-50 text-blue-700',
  shipped:   'bg-amber-50 text-amber-700',
  arrived:   'bg-purple-50 text-purple-700',
  received:  'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

const SHIPMENT_STATUS_STYLE: Record<string, string> = {
  planned:   'bg-zinc-100 text-zinc-600',
  shipped:   'bg-blue-50 text-blue-700',
  arrived:   'bg-purple-50 text-purple-700',
  received:  'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

const CLEARANCE_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  cleared: 'bg-green-50 text-green-700',
  delayed: 'bg-red-50 text-red-700',
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(2)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

type ItemForm = {
  product_id:           string
  quantity_ordered:     string
  quantity_received:    string
  unit_cost:            string
  landed_cost_per_unit: string
  cbm_per_unit:         string
}

const EMPTY_ITEM: ItemForm = {
  product_id:           '',
  quantity_ordered:     '1',
  quantity_received:    '0',
  unit_cost:            '',
  landed_cost_per_unit: '',
  cbm_per_unit:         '',
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [po, setPo]           = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)

  // Header edit
  const [editHeaderOpen, setEditHeaderOpen] = useState(false)

  // Status
  const [statusOpen, setStatusOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Shipments
  const [shipments, setShipments]         = useState<ShipmentListItem[]>([])
  const [shipmentsLoading, setShipmentsLoading] = useState(true)

  const fetchShipments = useCallback(async () => {
    setShipmentsLoading(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/shipments?po_id=${id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.ok) setShipments(await res.json())
    } catch { /* non-critical */ } finally {
      setShipmentsLoading(false)
    }
  }, [id])

  // Item dialog
  const [itemDialog, setItemDialog]   = useState(false)
  const [editItem, setEditItem]       = useState<PurchaseOrderItem | null>(null)
  const [itemForm, setItemForm]       = useState<ItemForm>(EMPTY_ITEM)
  const [savingItem, setSavingItem]   = useState(false)
  const [deleteItem, setDeleteItem]   = useState<PurchaseOrderItem | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)

  const fetchPo = useCallback(async () => {
    setLoading(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/purchase-orders/${id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Failed to load PO')
      const data: PurchaseOrder = await res.json()
      setPo(data)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchPo() }, [fetchPo])
  useEffect(() => { fetchShipments() }, [fetchShipments])
  useEffect(() => {
    document.title = po ? `${po.po_number} | Tyres & Car Valeting` : 'Purchase Order | Tyres & Car Valeting'
  }, [po])

  // ── Status update ──────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus: PoStatus) {
    setUpdatingStatus(true)
    setStatusOpen(false)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ po_status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      toastSuccess(`Status updated to ${newStatus}`)
      fetchPo()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // ── Line items ─────────────────────────────────────────────────────────────
  function openAddItem() {
    setEditItem(null)
    setItemForm(EMPTY_ITEM)
    setItemDialog(true)
  }

  function openEditItem(item: PurchaseOrderItem) {
    setEditItem(item)
    setItemForm({
      product_id:           item.product_id,
      quantity_ordered:     String(item.quantity_ordered),
      quantity_received:    String(item.quantity_received),
      unit_cost:            String(item.unit_cost),
      landed_cost_per_unit: item.landed_cost_per_unit != null ? String(item.landed_cost_per_unit) : '',
      cbm_per_unit:         item.cbm_per_unit != null ? String(item.cbm_per_unit) : '',
    })
    setItemDialog(true)
  }

  async function handleSaveItem() {
    if (!itemForm.product_id && !editItem) return toastError('Product ID is required')
    if (!itemForm.unit_cost) return toastError('Unit cost is required')
    setSavingItem(true)
    try {
      const tok = await getToken()
      const payload = {
        product_id:           editItem ? undefined : itemForm.product_id.trim(),
        quantity_ordered:     Number(itemForm.quantity_ordered),
        quantity_received:    Number(itemForm.quantity_received),
        unit_cost:            Number(itemForm.unit_cost),
        landed_cost_per_unit: itemForm.landed_cost_per_unit ? Number(itemForm.landed_cost_per_unit) : null,
        cbm_per_unit:         itemForm.cbm_per_unit ? Number(itemForm.cbm_per_unit) : null,
      }
      const url    = editItem
        ? `${API}/api/admin/purchase-orders/${id}/items/${editItem.po_item_id}`
        : `${API}/api/admin/purchase-orders/${id}/items`
      const method = editItem ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
      toastSuccess(editItem ? 'Item updated' : 'Item added')
      setItemDialog(false)
      fetchPo()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingItem(false)
    }
  }

  async function handleDeleteItem() {
    if (!deleteItem) return
    setDeletingItem(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/purchase-orders/${id}/items/${deleteItem.po_item_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      toastSuccess('Item removed')
      setDeleteItem(null)
      fetchPo()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingItem(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!po) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Purchase Orders', href: '/admin/purchase-orders' }, { label: 'Not found' }]} />
        <p className="mt-6 text-sm text-zinc-500">Purchase order not found.</p>
      </div>
    )
  }

  const isEditable = po.po_status === 'draft' || po.po_status === 'ordered'
  const itemsTotal = po.purchase_order_items.reduce((s, i) => s + i.unit_cost * i.quantity_ordered, 0)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Purchase Orders', href: '/admin/purchase-orders' },
          { label: po.po_number },
        ]} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Header card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">{po.po_number}</h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {po.suppliers?.supplier_name ?? '—'} → {po.warehouses?.warehouse_name ?? '—'}
                </p>
              </div>
              <button type="button" onClick={() => setEditHeaderOpen(true)} className="text-zinc-400 hover:text-zinc-700">
                <Pencil className="w-4 h-4" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-y-3 gap-x-6 sm:grid-cols-3 text-sm">
              {[
                ['Order Date',     fmtDate(po.order_date)],
                ['Shipment Date',  fmtDate(po.shipment_date)],
                ['ETA',            fmtDate(po.eta_date)],
                ['Currency',       po.currency],
                ['Exchange Rate',  po.exchange_rate != null ? String(po.exchange_rate) : '—'],
                ['Freight Cost',   po.freight_cost != null ? `${po.currency} ${fmt(po.freight_cost)}` : '—'],
                ['Clearance Cost', po.clearance_cost != null ? `${po.currency} ${fmt(po.clearance_cost)}` : '—'],
                ['Total Cost',     po.total_cost != null ? `${po.currency} ${fmt(po.total_cost)}` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col border-b border-zinc-100 pb-2">
                  <dt className="text-zinc-500 text-xs">{label}</dt>
                  <dd className="font-medium text-zinc-800 mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>

            {po.notes && (
              <p className="mt-4 text-sm text-zinc-600 border-t border-zinc-100 pt-3 whitespace-pre-wrap">{po.notes}</p>
            )}
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">Line Items</h2>
              {isEditable && (
                <Button type="button" size="sm" onClick={openAddItem}>
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </Button>
              )}
            </div>

            {po.purchase_order_items.length === 0 ? (
              <p className="text-sm text-zinc-400">No line items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="pb-2 text-left text-xs font-medium text-zinc-500">SKU</th>
                      <th className="pb-2 text-right text-xs font-medium text-zinc-500">Ordered</th>
                      <th className="pb-2 text-right text-xs font-medium text-zinc-500">Received</th>
                      <th className="pb-2 text-right text-xs font-medium text-zinc-500">Unit Cost</th>
                      <th className="pb-2 text-right text-xs font-medium text-zinc-500">Landed/unit</th>
                      <th className="pb-2 text-right text-xs font-medium text-zinc-500">CBM/unit</th>
                      <th className="pb-2 text-right text-xs font-medium text-zinc-500">Line Total</th>
                      {isEditable && <th className="pb-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {po.purchase_order_items.map(item => (
                      <tr key={item.po_item_id} className="even:bg-zinc-50/50 hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 pr-4">
                          <p className="font-mono text-xs text-zinc-700">{item.skus?.sku ?? item.product_id.slice(0, 8) + '…'}</p>
                          <p className="text-xs text-zinc-400">{item.skus?.tyre_size_display ?? ''}</p>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{item.quantity_ordered}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          <span className={item.quantity_received >= item.quantity_ordered ? 'text-green-600' : 'text-zinc-700'}>
                            {item.quantity_received}
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{po.currency} {fmt(item.unit_cost)}</td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">{item.landed_cost_per_unit != null ? `${po.currency} ${fmt(item.landed_cost_per_unit)}` : '—'}</td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">{item.cbm_per_unit != null ? fmt(item.cbm_per_unit) : '—'}</td>
                        <td className="py-2.5 text-right tabular-nums font-medium">{po.currency} {fmt(item.unit_cost * item.quantity_ordered)}</td>
                        {isEditable && (
                          <td className="py-2.5 pl-4">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button type="button" onClick={() => openEditItem(item)} className="text-zinc-400 hover:text-zinc-700">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setDeleteItem(item)} className="text-zinc-400 hover:text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200">
                      <td colSpan={isEditable ? 6 : 5} className="py-2.5 text-xs text-zinc-500">
                        {po.purchase_order_items.length} items
                      </td>
                      <td className="py-2.5 text-right font-semibold">{po.currency} {fmt(itemsTotal)}</td>
                      {isEditable && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          {/* Shipments */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">
                  Linked Shipments
                  {shipments.length > 0 && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                      {shipments.length}
                    </span>
                  )}
                </h2>
              </div>
              <Link
                href="/admin/shipments"
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                <Plus className="w-3 h-3" /> New Shipment
              </Link>
            </div>

            {shipmentsLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-10 bg-zinc-100 rounded-lg animate-pulse" />)}
              </div>
            ) : shipments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
                No shipments linked to this purchase order yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[540px]">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="pb-2 text-left text-xs font-medium text-zinc-500">Container</th>
                      <th className="pb-2 text-left text-xs font-medium text-zinc-500">Status</th>
                      <th className="pb-2 text-left text-xs font-medium text-zinc-500">Clearance</th>
                      <th className="pb-2 text-left text-xs font-medium text-zinc-500">ETD</th>
                      <th className="pb-2 text-left text-xs font-medium text-zinc-500">ETA</th>
                      <th className="pb-2 text-left text-xs font-medium text-zinc-500">Warehouse</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {shipments.map(s => (
                      <tr key={s.shipment_id} className="even:bg-zinc-50/50 hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-xs text-zinc-700">{s.container_number ?? '—'}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SHIPMENT_STATUS_STYLE[s.shipment_status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                            {s.shipment_status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          {s.clearance_status ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CLEARANCE_STYLE[s.clearance_status] ?? ''}`}>
                              {s.clearance_status}
                            </span>
                          ) : <span className="text-zinc-300 text-xs">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-zinc-600">{fmtDate(s.etd)}</td>
                        <td className="py-2.5 pr-4 text-xs text-zinc-600">{fmtDate(s.eta)}</td>
                        <td className="py-2.5 pr-4 text-xs text-zinc-600">{s.warehouses?.warehouse_name ?? '—'}</td>
                        <td className="py-2.5">
                          <Link
                            href={`/admin/shipments/${s.shipment_id}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-56 lg:shrink-0 space-y-4">
          {/* Status */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Status</h3>
            <div className="relative">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => setStatusOpen(o => !o)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium capitalize ${STATUS_STYLE[po.po_status]}`}
              >
                {po.po_status}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-zinc-200 shadow-lg z-10 overflow-hidden">
                  {STATUS_FLOW.filter(s => s !== po.po_status).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      className="w-full px-3 py-2 text-sm text-left capitalize hover:bg-zinc-50 text-zinc-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Cost Summary</h3>
            <dl className="space-y-2 text-xs">
              {[
                ['Items',     `${po.currency} ${fmt(itemsTotal)}`],
                ['Freight',   po.freight_cost   != null ? `${po.currency} ${fmt(po.freight_cost)}`   : '—'],
                ['Clearance', po.clearance_cost != null ? `${po.currency} ${fmt(po.clearance_cost)}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-zinc-700">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-1 border-t border-zinc-100">
                <dt className="font-medium text-zinc-700">Total</dt>
                <dd className="font-semibold text-zinc-900">{po.currency} {fmt(po.total_cost)}</dd>
              </div>
            </dl>
          </div>

          {/* Supplier info */}
          {po.suppliers && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Supplier</h3>
              <p className="text-sm font-medium text-zinc-900">{po.suppliers.supplier_name}</p>
              {po.suppliers.contact_email && <p className="text-xs text-zinc-500 mt-0.5">{po.suppliers.contact_email}</p>}
              {po.suppliers.contact_phone && <p className="text-xs text-zinc-500">{po.suppliers.contact_phone}</p>}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push('/admin/purchase-orders')}
            className="w-full text-xs text-zinc-400 hover:text-zinc-600 text-center py-2"
          >
            ← Back to list
          </button>
        </div>
      </div>

      {/* Edit header sheet */}
      <PurchaseOrderSheet
        open={editHeaderOpen}
        onClose={() => setEditHeaderOpen(false)}
        onSaved={() => {
          setEditHeaderOpen(false)
          fetchPo()
        }}
        po={po}
      />

      {/* Add/edit item dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Line Item' : 'Add Line Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {!editItem && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Product <span className="text-red-500">*</span></label>
                <ProductSearchInput
                  value={itemForm.product_id}
                  onChange={val => setItemForm(f => ({ ...f, product_id: val }))}
                  placeholder="Search by SKU or name..."
                />
              </div>
            )}
            {editItem && (
              <div className="bg-zinc-50 rounded-lg p-3 text-xs">
                <p className="font-medium text-zinc-700">{editItem.skus?.tyre_size_display ?? 'Unknown SKU'}</p>
                <p className="text-zinc-400 font-mono">{editItem.skus?.sku ?? editItem.product_id}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Qty Ordered</label>
                <Input type="number" min={1} value={itemForm.quantity_ordered} onChange={e => setItemForm(f => ({ ...f, quantity_ordered: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Qty Received</label>
                <Input type="number" min={0} value={itemForm.quantity_received} onChange={e => setItemForm(f => ({ ...f, quantity_received: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Unit Cost <span className="text-red-500">*</span></label>
                <Input type="number" step="0.01" value={itemForm.unit_cost} onChange={e => setItemForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Landed/unit</label>
                <Input type="number" step="0.01" value={itemForm.landed_cost_per_unit} onChange={e => setItemForm(f => ({ ...f, landed_cost_per_unit: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">CBM/unit</label>
                <Input type="number" step="0.001" value={itemForm.cbm_per_unit} onChange={e => setItemForm(f => ({ ...f, cbm_per_unit: e.target.value }))} placeholder="0.000" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button>
              <Button type="button" disabled={savingItem} onClick={handleSaveItem}>
                {savingItem ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete item confirmation */}
      <Dialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Line Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            <strong>{deleteItem?.skus?.tyre_size_display ?? deleteItem?.product_id}</strong> will be removed from this PO.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deletingItem} onClick={handleDeleteItem}>
              {deletingItem ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
