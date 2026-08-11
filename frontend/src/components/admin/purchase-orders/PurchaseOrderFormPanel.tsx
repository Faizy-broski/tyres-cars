'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Textarea } from '@/components/ui/textarea'
import { ProductSearchInput } from '@/components/admin/products/ProductSearchInput'
import { toastSuccess, toastError } from '@/lib/toast'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import type { PurchaseOrder, PurchaseOrderListItem, Supplier, Warehouse, PoStatus } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'CNY', 'JPY']
const PO_STATUS_OPTIONS: PoStatus[] = ['draft', 'ordered', 'shipped', 'arrived', 'received', 'cancelled']

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-zinc-100 text-zinc-600',
  ordered:   'bg-blue-50 text-blue-700',
  shipped:   'bg-amber-50 text-amber-700',
  arrived:   'bg-purple-50 text-purple-700',
  received:  'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

export type PurchaseOrderFormState = {
  supplier_id:    string
  warehouse_id:   string
  po_status:      PoStatus
  order_date:     string
  shipment_date:  string
  eta_date:       string
  currency:       string
  exchange_rate:  string
  freight_cost:   string
  clearance_cost: string
  notes:          string
}

export type LineItem = {
  product_id:       string
  quantity_ordered: string
  unit_cost:        string
  cbm_per_unit:     string
}

export const EMPTY_PO_FORM: PurchaseOrderFormState = {
  supplier_id:    '',
  warehouse_id:   '',
  po_status:      'draft',
  order_date:     new Date().toISOString().slice(0, 10),
  shipment_date:  '',
  eta_date:       '',
  currency:       'AUD',
  exchange_rate:  '',
  freight_cost:   '',
  clearance_cost: '',
  notes:          '',
}

export const EMPTY_LINE: LineItem = {
  product_id:       '',
  quantity_ordered: '1',
  unit_cost:        '',
  cbm_per_unit:     '',
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:            'create' | 'edit'
  poId?:           string
  initialPo?:      PurchaseOrderListItem | null
  onSaved:         (result: { po_id: string; po_number?: string }) => void
  onRequestDelete?: () => void
}

export function PurchaseOrderFormPanel({
  mode,
  poId,
  initialPo,
  onSaved,
  onRequestDelete,
}: Props) {
  const isEdit = mode === 'edit'

  const [suppliers, setSuppliers]   = useState<Pick<Supplier, 'supplier_id' | 'supplier_name'>[]>([])
  const [warehouses, setWarehouses] = useState<Pick<Warehouse, 'warehouse_id' | 'warehouse_name'>[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [form, setForm] = useState<PurchaseOrderFormState>(() => {
    if (initialPo) {
      return {
        supplier_id:    initialPo.suppliers?.supplier_id ?? '',
        warehouse_id:   initialPo.warehouses?.warehouse_id ?? '',
        po_status:      initialPo.po_status ?? 'draft',
        order_date:     initialPo.order_date ? initialPo.order_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        shipment_date:  initialPo.shipment_date ? initialPo.shipment_date.slice(0, 10) : '',
        eta_date:       initialPo.eta_date ? initialPo.eta_date.slice(0, 10) : '',
        currency:       initialPo.currency ?? 'AUD',
        exchange_rate:  '',
        freight_cost:   initialPo.freight_cost != null ? String(initialPo.freight_cost) : '',
        clearance_cost: initialPo.clearance_cost != null ? String(initialPo.clearance_cost) : '',
        notes:          '',
      }
    }
    return EMPTY_PO_FORM
  })

  const [lines, setLines]           = useState<LineItem[]>([{ ...EMPTY_LINE }])
  const [fullPo, setFullPo]         = useState<PurchaseOrder | null>(null)
  const [loadingPo, setLoadingPo]   = useState(false)
  const [saving, setSaving]         = useState(false)

  // Load suppliers and warehouses
  useEffect(() => {
    async function loadMeta() {
      try {
        const tok = await getToken()
        const h = { Authorization: `Bearer ${tok}` }
        const [sRes, wRes] = await Promise.all([
          fetch(`${API}/api/admin/suppliers`, { headers: h }),
          fetch(`${API}/api/admin/orders/warehouses?all=true`, { headers: h }),
        ])
        if (sRes.ok) {
          const sJson = await sRes.json()
          setSuppliers(Array.isArray(sJson) ? sJson : (sJson.data ?? []))
        }
        if (wRes.ok) {
          const wJson = await wRes.json()
          setWarehouses(Array.isArray(wJson) ? wJson : (wJson.data ?? []))
        }
      } catch (err) {
        console.error('Failed to load PO meta', err)
      } finally {
        setLoadingMeta(false)
      }
    }
    loadMeta()
  }, [])

  // If in edit mode and poId is provided, fetch full PO details
  useEffect(() => {
    if (!isEdit || !poId) {
      if (!isEdit) {
        setForm(EMPTY_PO_FORM)
        setLines([{ ...EMPTY_LINE }])
        setFullPo(null)
      }
      return
    }

    let active = true
    async function fetchPo() {
      setLoadingPo(true)
      try {
        const tok = await getToken()
        const res = await fetch(`${API}/api/admin/purchase-orders/${poId}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (res.ok && active) {
          const data: PurchaseOrder = await res.json()
          setFullPo(data)
          setForm({
            supplier_id:    data.suppliers?.supplier_id ?? '',
            warehouse_id:   data.warehouses?.warehouse_id ?? '',
            po_status:      data.po_status ?? 'draft',
            order_date:     data.order_date ? data.order_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            shipment_date:  data.shipment_date ? data.shipment_date.slice(0, 10) : '',
            eta_date:       data.eta_date ? data.eta_date.slice(0, 10) : '',
            currency:       data.currency ?? 'AUD',
            exchange_rate:  data.exchange_rate != null ? String(data.exchange_rate) : '',
            freight_cost:   data.freight_cost != null ? String(data.freight_cost) : '',
            clearance_cost: data.clearance_cost != null ? String(data.clearance_cost) : '',
            notes:          data.notes ?? '',
          })
        }
      } catch (err) {
        console.error('Failed to fetch PO detail', err)
      } finally {
        if (active) setLoadingPo(false)
      }
    }

    fetchPo()
    return () => { active = false }
  }, [isEdit, poId])

  function setField<K extends keyof PurchaseOrderFormState>(k: K, v: PurchaseOrderFormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function setLine(i: number, k: keyof LineItem, v: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }

  function addLine() {
    setLines(prev => [...prev, { ...EMPTY_LINE }])
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i))
  }

  const estTotal = (
    lines.reduce((s, l) => s + (Number(l.unit_cost) || 0) * (Number(l.quantity_ordered) || 0), 0)
    + (Number(form.freight_cost) || 0)
    + (Number(form.clearance_cost) || 0)
  ).toFixed(2)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!isEdit) {
      if (!form.supplier_id) return toastError('Supplier is required')
      if (!form.warehouse_id) return toastError('Warehouse is required')
      if (!form.order_date) return toastError('Order date is required')
      if (lines.length === 0) return toastError('Add at least one line item')
      if (lines.some(l => !l.product_id || !l.unit_cost)) {
        return toastError('All line items need a product selection and unit cost')
      }
    }

    setSaving(true)
    try {
      const tok = await getToken()
      let res: Response

      if (isEdit) {
        const patch: Record<string, unknown> = {
          po_status:      form.po_status,
          order_date:     form.order_date || null,
          shipment_date:  form.shipment_date || null,
          eta_date:       form.eta_date || null,
          currency:       form.currency,
          exchange_rate:  form.exchange_rate ? Number(form.exchange_rate) : null,
          freight_cost:   form.freight_cost ? Number(form.freight_cost) : null,
          clearance_cost: form.clearance_cost ? Number(form.clearance_cost) : null,
          notes:          form.notes || null,
        }

        res = await fetch(`${API}/api/admin/purchase-orders/${poId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify(patch),
        })
      } else {
        const payload = {
          supplier_id:    form.supplier_id,
          warehouse_id:   form.warehouse_id,
          order_date:     form.order_date,
          shipment_date:  form.shipment_date || null,
          eta_date:       form.eta_date || null,
          currency:       form.currency,
          exchange_rate:  form.exchange_rate ? Number(form.exchange_rate) : null,
          freight_cost:   form.freight_cost ? Number(form.freight_cost) : null,
          clearance_cost: form.clearance_cost ? Number(form.clearance_cost) : null,
          notes:          form.notes || null,
          items: lines.map(l => ({
            product_id:       l.product_id.trim(),
            quantity_ordered: Number(l.quantity_ordered) || 1,
            unit_cost:        Number(l.unit_cost) || 0,
            cbm_per_unit:     l.cbm_per_unit ? Number(l.cbm_per_unit) : null,
          })),
        }

        res = await fetch(`${API}/api/admin/purchase-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Save failed')
      }

      const data = await res.json().catch(() => ({}))
      toastSuccess(isEdit ? 'Purchase order updated' : `PO ${data.po_number ?? ''} created`)
      onSaved({ po_id: isEdit ? poId! : data.po_id, po_number: data.po_number })
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save purchase order')
    } finally {
      setSaving(false)
    }
  }

  const activePoNumber = fullPo?.po_number ?? initialPo?.po_number
  const activePoStatus = fullPo?.po_status ?? initialPo?.po_status ?? form.po_status
  const isDraft = activePoStatus === 'draft'

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'
  const sectionHead = 'text-xs font-bold text-zinc-500 uppercase tracking-wide py-1'
  const Req = () => <span className="text-red-500">*</span>

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Panel Top Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              {isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h2>
            {isEdit && activePoStatus && (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${STATUS_STYLE[activePoStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {activePoStatus}
              </span>
            )}
          </div>
          {isEdit && activePoNumber && (
            <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{activePoNumber}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEdit && poId && (
            <Link
              href={`/admin/purchase-orders/${poId}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              title="Open full purchase order details"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Details
            </Link>
          )}

          {isEdit && onRequestDelete && isDraft && (
            <button
              type="button"
              onClick={onRequestDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
              title="Delete purchase order"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          {loadingPo && (
            <div className="py-6 text-center text-xs text-zinc-400">Loading purchase order details…</div>
          )}

          {/* Supplier and Warehouse */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Supplier <Req /></label>
              <select
                value={form.supplier_id}
                onChange={e => setField('supplier_id', e.target.value)}
                className={inp}
                disabled={isEdit || loadingMeta}
                required={!isEdit}
              >
                <option value="">Select supplier…</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Destination Warehouse <Req /></label>
              <select
                value={form.warehouse_id}
                onChange={e => setField('warehouse_id', e.target.value)}
                className={inp}
                disabled={isEdit || loadingMeta}
                required={!isEdit}
              >
                <option value="">Select warehouse…</option>
                {warehouses.map(w => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status (edit mode only) */}
          {isEdit && (
            <div>
              <label className={lbl}>PO Status</label>
              <select
                value={form.po_status}
                onChange={e => setField('po_status', e.target.value as PoStatus)}
                className={inp}
              >
                {PO_STATUS_OPTIONS.map(st => (
                  <option key={st} value={st}>{st.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Order Date <Req /></label>
              <input
                type="date"
                required
                value={form.order_date}
                onChange={e => setField('order_date', e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Shipment (ETD)</label>
              <input
                type="date"
                value={form.shipment_date}
                onChange={e => setField('shipment_date', e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>ETA Date</label>
              <input
                type="date"
                value={form.eta_date}
                onChange={e => setField('eta_date', e.target.value)}
                className={inp}
              />
            </div>
          </div>

          {/* Currency & Financials */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={lbl}>Currency</label>
              <select
                value={form.currency}
                onChange={e => setField('currency', e.target.value)}
                className={inp}
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Exchange Rate</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.exchange_rate}
                onChange={e => setField('exchange_rate', e.target.value)}
                placeholder="1.0000"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Freight Cost</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.freight_cost}
                onChange={e => setField('freight_cost', e.target.value)}
                placeholder="0.00"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Clearance Cost</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.clearance_cost}
                onChange={e => setField('clearance_cost', e.target.value)}
                placeholder="0.00"
                className={inp}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={lbl}>Notes</label>
            <Textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              rows={2}
              placeholder="Internal notes, order instructions..."
              className="resize-none text-xs rounded-xl"
            />
          </div>

          {/* Line Items Section - Create Mode */}
          {!isEdit && (
            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <p className={sectionHead}>Line Items</p>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add line
                </button>
              </div>

              <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100/80 border-b border-zinc-200">
                      <th className="px-3 py-2 text-left font-semibold text-zinc-600">Product</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-600 w-16">Qty</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-600 w-20">Unit Cost</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-600 w-16">CBM</th>
                      <th className="px-2 py-2 w-7" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/80 bg-white">
                    {lines.map((line, i) => (
                      <tr key={i} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-2 py-2">
                          <ProductSearchInput
                            value={line.product_id}
                            onChange={val => setLine(i, 'product_id', val)}
                            placeholder="Search SKU..."
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity_ordered}
                            onChange={e => setLine(i, 'quantity_ordered', e.target.value)}
                            className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unit_cost}
                            onChange={e => setLine(i, 'unit_cost', e.target.value)}
                            placeholder="0.00"
                            className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            value={line.cbm_per_unit}
                            onChange={e => setLine(i, 'cbm_per_unit', e.target.value)}
                            placeholder="0.00"
                            className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </td>
                        <td className="px-1 py-2 text-center">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end text-xs text-zinc-500 font-medium">
                Est. total:&nbsp;
                <span className="font-bold text-zinc-900">{form.currency} {estTotal}</span>
              </div>
            </div>
          )}

          {/* Line Items Summary in Edit Mode */}
          {isEdit && fullPo && (
            <div className="space-y-2 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <p className={sectionHead}>Order Items ({fullPo.purchase_order_items?.length ?? 0})</p>
                <Link
                  href={`/admin/purchase-orders/${poId}`}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  Manage Items <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden bg-zinc-50/40">
                {(fullPo.purchase_order_items ?? []).map((item, idx) => (
                  <div key={item.po_item_id ?? idx} className="px-3 py-2 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-zinc-900 truncate">
                        {item.skus?.sku ?? item.product_id}
                      </p>
                      {item.skus?.tyre_size_display && (
                        <p className="text-[11px] text-zinc-400">{item.skus.tyre_size_display}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-zinc-900">{item.quantity_ordered} ordered</span>
                      <span className="text-zinc-400 block text-[11px]">
                        @ {fullPo.currency} {Number(item.unit_cost).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel Footer Submit Button */}
        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />
                {isEdit ? 'Saving Changes…' : 'Creating PO…'}
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Create Purchase Order'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function Req() {
  return <span className="text-red-500 ml-0.5">*</span>
}
