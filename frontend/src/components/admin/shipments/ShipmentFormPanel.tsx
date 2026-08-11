'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Textarea } from '@/components/ui/textarea'
import { toastSuccess, toastError } from '@/lib/toast'
import { Trash2, ExternalLink } from 'lucide-react'
import type { Shipment, ShipmentListItem, Warehouse, ShipmentStatus, ClearanceStatus, PurchaseOrderListItem } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const SHIPMENT_STATUS_OPTIONS: ShipmentStatus[] = ['planned', 'shipped', 'arrived', 'received', 'cancelled']
const CLEARANCE_STATUS_OPTIONS: { value: ClearanceStatus | ''; label: string }[] = [
  { value: '',        label: 'Not set' },
  { value: 'pending', label: 'Pending' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'delayed', label: 'Delayed' },
]

const STATUS_STYLE: Record<string, string> = {
  planned:   'bg-zinc-100 text-zinc-600',
  shipped:   'bg-blue-50 text-blue-700',
  arrived:   'bg-purple-50 text-purple-700',
  received:  'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

export type ShipmentFormState = {
  po_id:             string
  warehouse_id:      string
  container_number:  string
  vessel_name:       string
  booking_reference: string
  etd:               string
  eta:               string
  arrival_date:      string
  clearance_status:  ClearanceStatus | ''
  shipment_status:   ShipmentStatus
}

export const EMPTY_SHIPMENT_FORM: ShipmentFormState = {
  po_id:             '',
  warehouse_id:      '',
  container_number:  '',
  vessel_name:       '',
  booking_reference: '',
  etd:               '',
  eta:               '',
  arrival_date:      '',
  clearance_status:  '',
  shipment_status:   'planned',
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:             'create' | 'edit'
  shipmentId?:      string
  initialShipment?: ShipmentListItem | null
  onSaved:          () => void
  onRequestDelete?: () => void
}

export function ShipmentFormPanel({
  mode,
  shipmentId,
  initialShipment,
  onSaved,
  onRequestDelete,
}: Props) {
  const isEdit = mode === 'edit'

  const [warehouses, setWarehouses] = useState<Pick<Warehouse, 'warehouse_id' | 'warehouse_name'>[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<Pick<PurchaseOrderListItem, 'po_id' | 'po_number'>[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [form, setForm] = useState<ShipmentFormState>(() => {
    if (initialShipment) {
      return {
        po_id:             initialShipment.purchase_orders?.po_id ?? '',
        warehouse_id:      initialShipment.warehouses?.warehouse_id ?? '',
        container_number:  initialShipment.container_number ?? '',
        vessel_name:       initialShipment.vessel_name ?? '',
        booking_reference: initialShipment.booking_reference ?? '',
        etd:               initialShipment.etd ? initialShipment.etd.slice(0, 10) : '',
        eta:               initialShipment.eta ? initialShipment.eta.slice(0, 10) : '',
        arrival_date:      initialShipment.arrival_date ? initialShipment.arrival_date.slice(0, 10) : '',
        clearance_status:  (initialShipment.clearance_status as ClearanceStatus) ?? '',
        shipment_status:   initialShipment.shipment_status ?? 'planned',
      }
    }
    return EMPTY_SHIPMENT_FORM
  })

  const [fullShipment, setFullShipment] = useState<Shipment | null>(null)
  const [loadingShipment, setLoadingShipment] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load warehouses & recent POs for dropdown
  useEffect(() => {
    async function loadMeta() {
      try {
        const tok = await getToken()
        const h = { Authorization: `Bearer ${tok}` }
        const [wRes, pRes] = await Promise.all([
          fetch(`${API}/api/admin/orders/warehouses?all=true`, { headers: h }),
          fetch(`${API}/api/admin/purchase-orders?limit=50`, { headers: h }),
        ])
        if (wRes.ok) {
          const wJson = await wRes.json()
          setWarehouses(Array.isArray(wJson) ? wJson : (wJson.data ?? []))
        }
        if (pRes.ok) {
          const pJson = await pRes.json()
          setPurchaseOrders(Array.isArray(pJson) ? pJson : (pJson.data ?? []))
        }
      } catch (err) {
        console.error('Failed to load shipment meta', err)
      } finally {
        setLoadingMeta(false)
      }
    }
    loadMeta()
  }, [])

  // If in edit mode and shipmentId is provided, fetch full details
  useEffect(() => {
    if (!isEdit || !shipmentId) {
      if (!isEdit) {
        setForm(EMPTY_SHIPMENT_FORM)
        setFullShipment(null)
      }
      return
    }

    let active = true
    async function fetchShipment() {
      setLoadingShipment(true)
      try {
        const tok = await getToken()
        const res = await fetch(`${API}/api/admin/shipments/${shipmentId}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (res.ok && active) {
          const data: Shipment = await res.json()
          setFullShipment(data)
          setForm({
            po_id:             data.purchase_orders?.po_id ?? '',
            warehouse_id:      data.warehouses?.warehouse_id ?? '',
            container_number:  data.container_number ?? '',
            vessel_name:       data.vessel_name ?? '',
            booking_reference: data.booking_reference ?? '',
            etd:               data.etd ? data.etd.slice(0, 10) : '',
            eta:               data.eta ? data.eta.slice(0, 10) : '',
            arrival_date:      data.arrival_date ? data.arrival_date.slice(0, 10) : '',
            clearance_status:  (data.clearance_status as ClearanceStatus) ?? '',
            shipment_status:   data.shipment_status ?? 'planned',
          })
        }
      } catch (err) {
        console.error('Failed to fetch shipment detail', err)
      } finally {
        if (active) setLoadingShipment(false)
      }
    }

    fetchShipment()
    return () => { active = false }
  }, [isEdit, shipmentId])

  function setField<K extends keyof ShipmentFormState>(k: K, v: ShipmentFormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.warehouse_id) {
      return toastError('Destination warehouse is required')
    }

    setSaving(true)
    try {
      const tok = await getToken()
      const payload = {
        po_id:             form.po_id || null,
        warehouse_id:      form.warehouse_id,
        container_number:  form.container_number.trim() || null,
        vessel_name:       form.vessel_name.trim() || null,
        booking_reference: form.booking_reference.trim() || null,
        etd:               form.etd || null,
        eta:               form.eta || null,
        arrival_date:      form.arrival_date || null,
        clearance_status:  form.clearance_status || null,
        shipment_status:   form.shipment_status,
      }

      const url = isEdit ? `${API}/api/admin/shipments/${shipmentId}` : `${API}/api/admin/shipments`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Save failed')
      }

      toastSuccess(isEdit ? 'Shipment updated' : 'Shipment created')
      onSaved()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save shipment')
    } finally {
      setSaving(false)
    }
  }

  const activeContainer = fullShipment?.container_number ?? initialShipment?.container_number ?? form.container_number
  const activeStatus = fullShipment?.shipment_status ?? initialShipment?.shipment_status ?? form.shipment_status
  const isDeletable = ['planned', 'cancelled'].includes(activeStatus)

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Panel Top Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              {isEdit ? 'Edit Shipment' : 'New Shipment'}
            </h2>
            {isEdit && activeStatus && (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${STATUS_STYLE[activeStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {activeStatus}
              </span>
            )}
          </div>
          {isEdit && (
            <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">
              {activeContainer ? `Container: ${activeContainer}` : `ID: ${shipmentId?.slice(0, 8)}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEdit && shipmentId && (
            <Link
              href={`/admin/shipments/${shipmentId}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              title="Open full shipment details"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Details
            </Link>
          )}

          {isEdit && onRequestDelete && isDeletable && (
            <button
              type="button"
              onClick={onRequestDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
              title="Delete shipment"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          {loadingShipment && (
            <div className="py-6 text-center text-xs text-zinc-400">Loading shipment details…</div>
          )}

          {/* Warehouse and Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Destination Warehouse <Req /></label>
              <select
                value={form.warehouse_id}
                onChange={e => setField('warehouse_id', e.target.value)}
                className={inp}
                required
                disabled={loadingMeta}
              >
                <option value="">Select warehouse…</option>
                {warehouses.map(w => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Shipment Status</label>
              <select
                value={form.shipment_status}
                onChange={e => setField('shipment_status', e.target.value as ShipmentStatus)}
                className={inp}
              >
                {SHIPMENT_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Linked PO */}
          <div>
            <label className={lbl}>Linked Purchase Order</label>
            <div className="space-y-1.5">
              {purchaseOrders.length > 0 ? (
                <select
                  value={form.po_id}
                  onChange={e => setField('po_id', e.target.value)}
                  className={inp}
                >
                  <option value="">— Select PO (or leave empty) —</option>
                  {purchaseOrders.map(p => (
                    <option key={p.po_id} value={p.po_id}>{p.po_number}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.po_id}
                  onChange={e => setField('po_id', e.target.value)}
                  placeholder="Paste PO UUID (optional)…"
                  className={`${inp} font-mono text-xs`}
                />
              )}
            </div>
          </div>

          {/* Container, Vessel & Booking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Container Number</label>
              <input
                type="text"
                value={form.container_number}
                onChange={e => setField('container_number', e.target.value)}
                placeholder="e.g. ABCU1234567"
                className={`${inp} font-mono`}
              />
            </div>
            <div>
              <label className={lbl}>Vessel Name</label>
              <input
                type="text"
                value={form.vessel_name}
                onChange={e => setField('vessel_name', e.target.value)}
                placeholder="e.g. MSC Daria"
                className={inp}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>Booking Reference</label>
            <input
              type="text"
              value={form.booking_reference}
              onChange={e => setField('booking_reference', e.target.value)}
              placeholder="Forwarder booking ref"
              className={inp}
            />
          </div>

          {/* Dates & Clearance */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Departure Date (ETD)</label>
                <input
                  type="date"
                  value={form.etd}
                  onChange={e => setField('etd', e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Estimated Arrival (ETA)</label>
                <input
                  type="date"
                  value={form.eta}
                  onChange={e => setField('eta', e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Actual Arrival</label>
                <input
                  type="date"
                  value={form.arrival_date}
                  onChange={e => setField('arrival_date', e.target.value)}
                  className={inp}
                />
              </div>
            </div>

            <div>
              <label className={lbl}>Clearance Status</label>
              <select
                value={form.clearance_status}
                onChange={e => setField('clearance_status', e.target.value as ClearanceStatus | '')}
                className={inp}
              >
                {CLEARANCE_STATUS_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
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
                {isEdit ? 'Saving Changes…' : 'Creating Shipment…'}
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Create Shipment'
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
