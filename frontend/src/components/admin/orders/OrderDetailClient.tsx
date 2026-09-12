'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, MoreVertical, Trash2 } from 'lucide-react'
import type {
  OrderDetail,
  PaymentStatus, OrderStatus,
} from '@/types/admin.types'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogTitle, DialogClose,
} from '@/components/ui/dialog'
import { toastSuccess, toastError } from '@/lib/toast'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins} minute${mins > 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  return fmtDate(d)
}

function fmtCurrency(amount: number | null | undefined, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount ?? 0)
}

// ── Status dropdown ────────────────────────────────────────────────────────

type StatusOption = { value: string; label: string; cls: string }

function StatusDropdown({
  label, value, options, onChange, loading,
}: {
  label:    string
  value:    string
  options:  StatusOption[]
  onChange: (val: string) => void
  loading:  boolean
}) {
  const current = options.find(o => o.value === value) ?? options[0]
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className={`rounded-lg border px-3 py-1.5 text-sm font-medium h-auto w-auto ${current?.cls ?? 'border-zinc-300 bg-white text-zinc-700'}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const PAYMENT_OPTIONS: StatusOption[] = [
  { value: 'unpaid',   label: 'Unpaid',   cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'paid',     label: 'Paid',     cls: 'border-green-200 bg-green-50 text-green-700' },
  { value: 'refunded', label: 'Refunded', cls: 'border-zinc-200 bg-zinc-100 text-zinc-600' },
]

const ORDER_STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending',    label: 'Pending',    cls: 'border-zinc-200 bg-zinc-100 text-zinc-600' },
  { value: 'paid',       label: 'Paid',       cls: 'border-blue-200 bg-blue-50 text-blue-700' },
  { value: 'processing', label: 'Processing', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'fulfilled',  label: 'Fulfilled',  cls: 'border-green-200 bg-green-50 text-green-700' },
  { value: 'cancelled',  label: 'Cancelled',  cls: 'border-red-200 bg-red-50 text-red-700' },
  { value: 'refunded',   label: 'Refunded',   cls: 'border-zinc-200 bg-zinc-100 text-zinc-600' },
]

// ── Main component ─────────────────────────────────────────────────────────

export default function OrderDetailClient({
  order: initialOrder, accessToken,
}: {
  order: OrderDetail; accessToken: string
}) {
  const router      = useRouter()

  const [order, setOrder]             = useState<OrderDetail>(initialOrder)
  const [statusSaving, setStatusSaving] = useState(false)

  const [notesValue,   setNotesValue]   = useState(initialOrder.notes ?? '')
  const [notesDirty,   setNotesDirty]   = useState(false)
  const [notesSaving,  setNotesSaving]  = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  async function patchStatus(patch: { paymentStatus?: string; orderStatus?: string }) {
    setStatusSaving(true)
    try {
      const res = await fetch(`${API}/api/admin/orders/${order.order_id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body:    JSON.stringify({ paymentStatus: patch.paymentStatus, fulfillmentStatus: patch.orderStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Status update failed (${res.status})`)
      }
      if (patch.paymentStatus) setOrder(p => ({ ...p, payment_status: patch.paymentStatus as PaymentStatus }))
      if (patch.orderStatus)   setOrder(p => ({ ...p, order_status:   patch.orderStatus   as OrderStatus }))
      toastSuccess('Status updated')
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to update status')
    } finally { setStatusSaving(false) }
  }

  async function saveNotes() {
    setNotesSaving(true)
    try {
      const res = await fetch(`${API}/api/admin/orders/${order.order_id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body:    JSON.stringify({ notes: notesValue }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save notes')
      }
      setOrder(p => ({ ...p, notes: notesValue }))
      setNotesDirty(false)
      toastSuccess('Notes saved')
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to save notes')
    } finally { setNotesSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/admin/orders/${order.order_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to delete order')
      }
      toastSuccess('Order deleted')
      router.push('/admin/orders')
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to delete order')
      setDeleting(false)
    }
  }

  const c       = order.customers
  const addr    = order.shipping_address_snapshot
  const billing = order.billing_address_snapshot

  const fullName = c ? [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email : '—'

  function copyOrderNumber() {
    navigator.clipboard.writeText(order.order_number)
  }

  return (
    <div>
      {/* Order header */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-zinc-900">#{order.order_number}</h1>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={copyOrderNumber}
              title="Copy order number"
              className="text-zinc-400 hover:text-zinc-600"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-zinc-500">{fmt(order.created_at)}</p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <StatusDropdown
            label="Payment Status"
            value={order.payment_status}
            options={PAYMENT_OPTIONS}
            onChange={val => patchStatus({ paymentStatus: val })}
            loading={statusSaving}
          />
          <StatusDropdown
            label="Order Status"
            value={order.order_status}
            options={ORDER_STATUS_OPTIONS}
            onChange={val => patchStatus({ orderStatus: val })}
            loading={statusSaving}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDelete(true)}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Order Summary */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Order Summary</h2>
              <Button type="button" variant="ghost" size="icon-sm" className="text-zinc-400 hover:text-zinc-700">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="border-b border-zinc-200 bg-zinc-50 hover:bg-zinc-50 odd:bg-zinc-50 even:bg-zinc-50">
                    {['Name', 'SKU', 'Quantity', 'Price', 'VAT', 'Order Total'].map(h => (
                      <TableHead key={h} className={h === 'Order Total' ? 'text-right' : ''}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-200">
                  {order.order_items.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No items.</TableCell>
                    </TableRow>
                  ) : (
                    order.order_items.map(item => {
                      const lineTotal = item.quantity * item.unit_price
                      return (
                        <TableRow key={item.order_item_id}>
                          <TableCell className="text-foreground font-medium">{item.skus?.tyre_size_display ?? 'Product'}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{item.skus?.sku ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{item.quantity}x</TableCell>
                          <TableCell className="text-foreground">{fmtCurrency(item.unit_price, order.currency)}</TableCell>
                          <TableCell className="text-muted-foreground">{fmtCurrency(lineTotal * 0.1, order.currency)}</TableCell>
                          <TableCell className="text-right font-medium text-foreground">{fmtCurrency(lineTotal, order.currency)}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="px-5 py-4 border-t border-zinc-100 space-y-2">
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Item Subtotal</span>
                <span>{fmtCurrency(order.order_items.reduce((s, i) => s + i.quantity * i.unit_price, 0), order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Shipping</span>
                <span>{fmtCurrency(order.shipping_cost, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>GST</span>
                <span>{fmtCurrency(order.gst_amount, order.currency)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>−{fmtCurrency(order.discount_amount, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-zinc-900 border-t border-zinc-100 pt-2">
                <span>Order Total</span>
                <span>{fmtCurrency(order.total_amount, order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payments */}
          {order.order_payments.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <h2 className="text-sm font-semibold text-zinc-900">Payments</h2>
                <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {order.payment_status === 'paid' ? 'Paid' : order.payment_status}
                </span>
              </div>
              <Table className="w-full text-sm">
                <TableBody className="divide-y divide-zinc-200">
                  {order.order_payments.map(p => (
                    <TableRow key={p.payment_id}>
                      <TableCell>
                        <p className="font-mono text-xs font-medium text-foreground">#{p.payment_reference ?? p.payment_id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(p.created_at)}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {p.payment_method.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          p.status === 'paid' ? 'text-green-700' : p.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'paid' ? 'bg-green-500' : p.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                          {p.status === 'paid' ? 'Paid' : p.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {fmtCurrency(p.amount, p.currency)}
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon-sm" className="text-zinc-400 hover:text-zinc-700">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50">
                <span className="text-xs text-zinc-500">Total paid by customer</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {fmtCurrency(order.order_payments.reduce((s, p) => s + p.amount, 0), order.currency)} {order.currency}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Customer profile card */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              {c ? (
                <Link href={`/admin/customers/${c.customer_id}`} className="text-base font-bold text-primary hover:underline">
                  {fullName}
                </Link>
              ) : (
                <span className="text-base font-bold text-zinc-900">Guest</span>
              )}
              {c && (
                <Button asChild variant="outline" className="rounded-lg border-primary text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/10 h-auto">
                  <Link href={`/admin/customers/${c.customer_id}`}>Edit Profile</Link>
                </Button>
              )}
            </div>

            {c && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <p className="text-zinc-400 mb-0.5">ID</p>
                    <p className="font-mono font-medium text-zinc-800">CUST-{c.customer_id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 mb-0.5">Email</p>
                    <p className="text-zinc-700 truncate">{c.email}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 mb-0.5">Name</p>
                    <p className="text-zinc-700">{fullName}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 mb-0.5">Member Since</p>
                    <p className="text-zinc-700">{c.created_at ? fmtDate(c.created_at) : '—'}</p>
                  </div>
                </div>
                {c.phone && (
                  <div className="text-xs">
                    <p className="text-zinc-400 mb-0.5">Phone Number</p>
                    <p className="text-zinc-700">{c.phone}</p>
                  </div>
                )}
                {addr && Object.keys(addr).length > 0 && (
                  <div className="text-xs border-t border-zinc-100 pt-3">
                    <p className="text-zinc-400 mb-1">Shipping Address</p>
                    <address className="not-italic text-zinc-700 space-y-0.5">
                      {(addr.line1 ?? addr.address_line1) && <p>{addr.line1 ?? addr.address_line1}</p>}
                      {(addr.line2) && <p>{addr.line2}</p>}
                      {((addr.suburb ?? addr.city) || addr.state || (addr.postcode ?? addr.postal_code)) && (
                        <p>{[(addr.suburb ?? addr.city), addr.state, (addr.postcode ?? addr.postal_code)].filter(Boolean).join(' ')}</p>
                      )}
                      {addr.country && <p>{addr.country}</p>}
                    </address>
                  </div>
                )}
                {billing && (
                  <div className="text-xs">
                    <p className="text-zinc-400 mb-1">Billing Address</p>
                    <p className="text-zinc-700">
                      {Object.keys(billing).length === 0
                        ? 'Same as shipping address'
                        : [billing.line1 ?? billing.address_line1, billing.suburb ?? billing.city, billing.state, billing.postcode ?? billing.postal_code].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
                {!billing && (
                  <div className="text-xs">
                    <p className="text-zinc-400 mb-1">Billing Address</p>
                    <p className="text-zinc-500 italic">Same as shipping address</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Activity feed */}
          {order.order_activity.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">Activity</h3>
              </div>
              <div className="p-4 space-y-3">
                {order.order_activity.map(a => (
                  <div key={a.activity_id} className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-700">
                        {a.description ?? a.event_type.replace(/_/g, ' ')}
                      </p>
                      {a.amount != null && (
                        <p className="text-xs text-zinc-500">{fmtCurrency(a.amount, a.currency ?? 'AUD')} {a.currency ?? 'AUD'}</p>
                      )}
                    </div>
                    <time className="text-xs text-zinc-400 shrink-0 whitespace-nowrap">
                      {fmtRelative(a.created_at)}
                    </time>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-900">Notes</h3>
              {notesDirty && (
                <Button
                  type="button"
                  size="xs"
                  onClick={saveNotes}
                  disabled={notesSaving}
                >
                  {notesSaving ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
            <textarea
              value={notesValue}
              onChange={e => { setNotesValue(e.target.value); setNotesDirty(true) }}
              rows={3}
              placeholder="Add internal notes…"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 resize-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={o => !o && !deleting && setShowDelete(false)}>
        <DialogContent className="rounded-2xl shadow-xl ring-0 bg-white sm:max-w-sm" showCloseButton={false}>
          <DialogTitle className="text-base font-semibold text-zinc-900">Delete Order</DialogTitle>
          <p className="text-sm text-zinc-600">
            Are you sure you want to delete order <strong>#{order.order_number}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
