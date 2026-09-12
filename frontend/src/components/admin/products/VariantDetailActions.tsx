'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, X, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminToken } from '@/lib/admin-token'
import { toastSuccess, toastError } from '@/lib/toast'
import type { ProductPrice, PriceType } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const PRICE_TYPES: PriceType[] = ['retail', 'wholesale', 'price_a', 'price_b', 'special', 'clearance']
const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  retail: 'Retail', wholesale: 'Wholesale',
  price_a: 'Price A', price_b: 'Price B',
  special: 'Special', clearance: 'Clearance',
}

type EditRow = {
  _key: string
  price_id?: string
  price_type: PriceType
  price_inc_gst: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

function newEmptyRow(): EditRow {
  return {
    _key: `new-${Date.now()}-${Math.random()}`,
    price_type: 'retail',
    price_inc_gst: 0,
    start_date: null,
    end_date: null,
    is_active: true,
  }
}

function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="p-0 gap-0 rounded-2xl shadow-xl ring-0 bg-white sm:max-w-xl flex flex-col max-h-[90vh]" showCloseButton={false}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
          <DialogTitle className="text-base font-semibold text-zinc-900">{title}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X className="w-4 h-4" />
            </Button>
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}

// ── Price Edit Modal ───────────────────────────────────────────────────────

function PriceEditModal({
  open,
  onClose,
  patternId,
  variantId,
  prices,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  patternId: string
  variantId: string
  prices: ProductPrice[]
  onSuccess: () => void
}) {
  const [rows, setRows] = useState<EditRow[]>([])
  const [toDelete, setToDelete] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Initialise rows when modal opens
  useEffect(() => {
    if (!open) return
    setRows(prices.map(p => ({
      _key: p.price_id,
      price_id: p.price_id,
      price_type: p.price_type,
      price_inc_gst: p.price_inc_gst,
      start_date: p.start_date,
      end_date: p.end_date,
      is_active: p.is_active,
    })))
    setToDelete(new Set())
  }, [open, prices])

  function updateRow(key: string, patch: Partial<EditRow>) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r))
  }

  function markDelete(row: EditRow) {
    if (row.price_id) {
      setToDelete(prev => new Set([...prev, row.price_id!]))
    }
    setRows(prev => prev.filter(r => r._key !== row._key))
  }

  function addRow() {
    setRows(prev => [...prev, newEmptyRow()])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const token = await getAdminToken()
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      const base = `${API}/api/admin/products/${patternId}/variants/${variantId}/prices`

      // Deletions
      for (const priceId of toDelete) {
        const res = await fetch(`${base}/${priceId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
      }

      // Existing rows — PATCH
      for (const row of rows.filter(r => r.price_id)) {
        const res = await fetch(`${base}/${row.price_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            price_type:    row.price_type,
            price_inc_gst: row.price_inc_gst,
            start_date:    row.start_date    || null,
            end_date:      row.end_date      || null,
            is_active:     row.is_active,
          }),
        })
        if (!res.ok) throw new Error(`Update failed: ${res.status}`)
      }

      // New rows — POST
      for (const row of rows.filter(r => !r.price_id)) {
        if (!row.price_inc_gst) continue // skip empty rows
        const res = await fetch(base, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            price_type:    row.price_type,
            price_inc_gst: row.price_inc_gst,
            start_date:    row.start_date    || null,
            end_date:      row.end_date      || null,
            is_active:     row.is_active,
          }),
        })
        if (!res.ok) throw new Error(`Add failed: ${res.status}`)
      }

      toastSuccess('Prices saved')
      onSuccess()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to save prices')
    } finally {
      setSaving(false)
    }
  }

  const visibleRows = rows

  return (
    <Modal title="Edit Prices" open={open} onClose={onClose}>
      <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
        {visibleRows.length === 0 && (
          <p className="text-sm text-zinc-400 italic">No prices configured. Add one below.</p>
        )}
        {visibleRows.map(row => (
          <div key={row._key} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
            {/* Row 1: type + price + active + delete */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={row.price_type}
                onChange={e => updateRow(row._key, { price_type: e.target.value as PriceType })}
                className="rounded border border-zinc-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {PRICE_TYPES.map(t => (
                  <option key={t} value={t}>{PRICE_TYPE_LABELS[t]}</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <span className="text-zinc-400 text-xs">A$</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.price_inc_gst}
                  onChange={e => updateRow(row._key, { price_inc_gst: Number(e.target.value) })}
                  className="w-24"
                  aria-label="Price inc. GST"
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={row.is_active}
                  onChange={e => updateRow(row._key, { is_active: e.target.checked })}
                  className="rounded border-zinc-300 text-primary focus:ring-primary/30"
                />
                Active
              </label>

              <button
                type="button"
                onClick={() => markDelete(row)}
                className="text-red-400 hover:text-red-600 transition-colors"
                aria-label="Delete price"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Row 2: date range */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <span>From</span>
                <input
                  type="date"
                  value={row.start_date ?? ''}
                  onChange={e => updateRow(row._key, { start_date: e.target.value || null })}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <span>To</span>
                <input
                  type="date"
                  value={row.end_date ?? ''}
                  onChange={e => updateRow(row._key, { end_date: e.target.value || null })}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add price
        </button>
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Prices'}
        </Button>
      </div>
    </Modal>
  )
}

// ── Pricing card three-dot menu ────────────────────────────────────────────

export function VariantPricingMenu({
  patternId,
  variantId,
  prices,
  onSuccess,
}: {
  patternId: string
  variantId: string
  prices: ProductPrice[]
  onSuccess?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <>
      <div ref={ref} className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Pricing options"
          onClick={() => setMenuOpen(o => !o)}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setShowEdit(true) }}
              className="w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Edit Prices
            </button>
          </div>
        )}
      </div>

      <PriceEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        patternId={patternId}
        variantId={variantId}
        prices={prices}
        onSuccess={() => { setShowEdit(false); onSuccess?.() }}
      />
    </>
  )
}

// ── Danger zone: Delete Variant ────────────────────────────────────────────

export function VariantDangerZone({
  patternId,
  variantId,
  variantName,
}: {
  patternId: string
  variantId: string
  variantName: string
}) {
  const router = useRouter()
  const [showDel, setShowDel]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const token = await getAdminToken()
      const res = await fetch(`${API}/api/admin/products/${patternId}/variants/${variantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      toastSuccess('Variant deleted')
      router.push(`/admin/products/${patternId}`)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to delete variant')
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={() => setShowDel(true)}
      >
        Delete Variant
      </Button>

      <Dialog open={showDel} onOpenChange={o => { if (!o) setShowDel(false) }}>
        <DialogContent className="rounded-2xl shadow-xl ring-0 bg-white sm:max-w-sm" showCloseButton={false}>
          <DialogTitle className="text-base font-semibold text-zinc-900">Delete Variant</DialogTitle>
          <p className="text-sm text-zinc-600">
            Delete <strong>{variantName}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
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
    </>
  )
}


