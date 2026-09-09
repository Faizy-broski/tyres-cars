'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { AdminShippingQuote, AdminShippingMethod, Warehouse } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

type QuoteFormState = {
  order_id:                string
  warehouse_id:            string
  destination_postcode:    string
  shipping_method_id:      string
  courier_name:            string
  freight_cost:            string
  customer_charge:         string
  estimated_delivery_days: string
}

const EMPTY_FORM: QuoteFormState = {
  order_id:                '',
  warehouse_id:            '',
  destination_postcode:    '',
  shipping_method_id:      '',
  courier_name:            '',
  freight_cost:            '',
  customer_charge:         '',
  estimated_delivery_days: '',
}

export default function ShippingQuotesPage() {
  const [quotes, setQuotes]         = useState<AdminShippingQuote[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [filterOrder, setFilterOrder] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm]             = useState<QuoteFormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [methods, setMethods]       = useState<AdminShippingMethod[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  useEffect(() => { document.title = 'Shipping Quotes | Tyres & Car Valeting' }, [])

  // Load supporting data for the form
  useEffect(() => {
    async function loadLookups() {
      const tok = await getToken()
      const [mRes, wRes] = await Promise.all([
        fetch(`${API}/api/admin/shipping/methods`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`${API}/api/admin/orders/warehouses`,  { headers: { Authorization: `Bearer ${tok}` } }),
      ])
      if (mRes.ok) setMethods(await mRes.json())
      if (wRes.ok) setWarehouses(await wRes.json())
    }
    loadLookups()
  }, [])

  const fetchQuotes = useCallback(async (p = 1, orderId = '') => {
    setLoading(true)
    try {
      const tok = await getToken()
      const params = new URLSearchParams({ page: String(p) })
      if (orderId.trim()) params.set('orderId', orderId.trim())
      const res = await fetch(`${API}/api/admin/shipping/quotes?${params}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Failed to load quotes')
      const { data, total: t } = await res.json()
      setQuotes(data)
      setTotal(t)
      setPage(p)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQuotes(1, filterOrder) }, [filterOrder])

  function set<K extends keyof QuoteFormState>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleCreate() {
    if (!form.warehouse_id)         return toastError('Warehouse is required')
    if (!form.destination_postcode) return toastError('Destination postcode is required')
    if (!form.shipping_method_id)   return toastError('Shipping method is required')
    if (!form.freight_cost)         return toastError('Freight cost is required')
    if (!form.customer_charge)      return toastError('Customer charge is required')

    setSaving(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/shipping/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          order_id:                form.order_id.trim() || null,
          warehouse_id:            form.warehouse_id,
          destination_postcode:    form.destination_postcode.trim(),
          shipping_method_id:      form.shipping_method_id,
          courier_name:            form.courier_name.trim() || null,
          freight_cost:            parseFloat(form.freight_cost),
          customer_charge:         parseFloat(form.customer_charge),
          estimated_delivery_days: form.estimated_delivery_days ? parseInt(form.estimated_delivery_days, 10) : null,
          api_response:            null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Create failed')
      }
      toastSuccess('Quote recorded')
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      fetchQuotes(1, filterOrder)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / 50) || 1

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <AdminBreadcrumb crumbs={[{ label: 'Shipping Quotes' }]} />
          <h1 className="mt-2 text-xl font-semibold text-zinc-900">Shipping Quotes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Freight quotes associated with orders and dispatch locations</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true) }} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Record Quote
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Filter by Order ID…"
          value={filterOrder}
          onChange={e => setFilterOrder(e.target.value)}
          className="max-w-xs text-sm"
        />
        <span className="text-sm text-zinc-400 self-center">{total} quote{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Quote ID</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Warehouse</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Postcode</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Courier</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500">Freight</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500">Charged</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">ETA Days</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 [&_tr:nth-child(even)]:bg-zinc-100 [&_tr:nth-child(odd)]:bg-white [&_tr:hover]:bg-amber-50 [&_tr]:transition-colors">
                {quotes.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-400">No quotes yet</td></tr>
                )}
                {quotes.map(q => (
                  <tr key={q.quote_id} className="even:bg-zinc-50/50 hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{q.quote_id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{q.order_id ? q.order_id.slice(0, 8).toUpperCase() : '—'}</td>
                    <td className="px-4 py-3 text-zinc-700 text-xs">{q.warehouses?.warehouse_name ?? q.warehouse_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-zinc-700">{q.destination_postcode}</td>
                    <td className="px-4 py-3 text-zinc-700 text-xs">{q.shipping_methods?.method_name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{q.courier_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-zinc-900 font-medium">${q.freight_cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-zinc-900 font-medium">${q.customer_charge.toFixed(2)}</td>
                    <td className="px-4 py-3 text-zinc-500 text-center">{q.estimated_delivery_days ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{new Date(q.created_at).toLocaleDateString('en-AU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchQuotes(page - 1, filterOrder)}>Previous</Button>
              <span className="text-sm text-zinc-500">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchQuotes(page + 1, filterOrder)}>Next</Button>
            </div>
          )}
        </>
      )}

      {/* Record Quote Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Shipping Quote</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Warehouse *</label>
              <Select value={form.warehouse_id} onValueChange={v => set('warehouse_id', v)}>
                <SelectTrigger className="w-full rounded-lg border-zinc-300">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Shipping Method *</label>
              <Select value={form.shipping_method_id} onValueChange={v => set('shipping_method_id', v)}>
                <SelectTrigger className="w-full rounded-lg border-zinc-300">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map(m => (
                    <SelectItem key={m.shipping_method_id} value={m.shipping_method_id}>{m.method_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Destination Postcode *</label>
              <Input value={form.destination_postcode} onChange={e => set('destination_postcode', e.target.value)} placeholder="e.g. 2000" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Freight Cost ($) *</label>
              <Input type="number" min="0" step="0.01" value={form.freight_cost} onChange={e => set('freight_cost', e.target.value)} placeholder="0.00" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Customer Charge ($) *</label>
              <Input type="number" min="0" step="0.01" value={form.customer_charge} onChange={e => set('customer_charge', e.target.value)} placeholder="0.00" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Courier Name</label>
              <Input value={form.courier_name} onChange={e => set('courier_name', e.target.value)} placeholder="e.g. StarTrack" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Est. Delivery Days</label>
              <Input type="number" min="1" value={form.estimated_delivery_days} onChange={e => set('estimated_delivery_days', e.target.value)} placeholder="e.g. 3" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Order ID (optional)</label>
              <Input value={form.order_id} onChange={e => set('order_id', e.target.value)} placeholder="UUID of linked order" className="font-mono text-xs" />
              <p className="text-[11px] text-zinc-400 mt-1">Leave blank if not yet linked to an order</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving…' : 'Record Quote'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

