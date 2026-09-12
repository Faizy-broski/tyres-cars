'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreVertical, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getAdminToken } from '@/lib/admin-token'
import { toastSuccess, toastError } from '@/lib/toast'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────

interface SkuStock {
  product_id: string
  sku: string
  tyre_size_display: string
  product_stock: { available_stock: number; minimum_stock_level: number }[]
}

interface SkuPrice {
  product_id: string
  tyre_size_display: string
  product_prices: { price_type: string; price_inc_gst: number }[]
}

interface PatternInfo {
  pattern_id: string
  pattern_name: string
  pattern_short_description: string | null
  on_sale: boolean
  discountable: boolean
  tags: string[] | null
}

interface Props {
  patternId:   string
  pattern:     PatternInfo
  skuStocks:   SkuStock[]
  skuPrices:   SkuPrice[]
  onSuccess?:  () => void
}

// ── Shared modal shell ─────────────────────────────────────────────────────

function Modal({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent
        className={`p-0 gap-0 rounded-2xl shadow-xl ring-0 bg-white flex flex-col max-h-[90vh] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
        showCloseButton={false}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 flex-shrink-0">
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

// ── Edit Stock Modal ───────────────────────────────────────────────────────

function EditStockModal({ patternId, skus, open, onClose, onSuccess }: {
  patternId: string; skus: SkuStock[]; open: boolean; onClose: () => void; onSuccess?: () => void
}) {
  const [saving, setSaving] = useState(false)

  const initial: Record<string, { availableStock: number; lowStockAlert: number }> = {}
  for (const s of skus) {
    const stock = s.product_stock[0]
    initial[s.product_id] = {
      availableStock: stock?.available_stock ?? 0,
      lowStockAlert:  stock?.minimum_stock_level ?? 10,
    }
  }
  const [stocks, setStocks] = useState(initial)

  function set(variantId: string, patch: Partial<{ availableStock: number; lowStockAlert: number }>) {
    setStocks(prev => ({ ...prev, [variantId]: { ...prev[variantId], ...patch } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const token = await getAdminToken()
      const results = await Promise.all(Object.entries(stocks).map(([variantId, row]) =>
        fetch(`${API}/api/admin/products/${patternId}/variants/${variantId}/stock`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ availableStock: row.availableStock, lowStockAlert: row.lowStockAlert }),
        })
      ))
      const failed = results.find(r => !r.ok)
      if (failed) throw new Error(`Error ${failed.status}`)
      toastSuccess('Stock levels updated')
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Stock Levels" open={open} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {skus.map(sku => (
            <div key={sku.product_id} className="flex items-center gap-3">
              <p className="text-sm font-medium text-zinc-800 flex-1 min-w-0 truncate">
                {sku.tyre_size_display} <span className="text-zinc-400 font-normal text-xs">— {sku.sku}</span>
              </p>
              <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                Available
                <Input
                  type="number"
                  min={0}
                  value={stocks[sku.product_id]?.availableStock ?? 0}
                  onChange={e => set(sku.product_id, { availableStock: Number(e.target.value) })}
                  aria-label={`Available stock for ${sku.sku}`}
                  className="w-20"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                Low stock alert
                <Input
                  type="number"
                  min={0}
                  value={stocks[sku.product_id]?.lowStockAlert ?? 10}
                  onChange={e => set(sku.product_id, { lowStockAlert: Number(e.target.value) })}
                  aria-label={`Low stock alert for ${sku.sku}`}
                  className="w-20"
                />
              </label>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Stock Levels'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit Prices Modal ──────────────────────────────────────────────────────

function EditPricesModal({ patternId, skus, open, onClose, onSuccess }: { patternId: string; skus: SkuPrice[]; open: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [saving, setSaving] = useState(false)

  const initial: Record<string, Record<string, number>> = {}
  for (const s of skus) {
    initial[s.product_id] = {}
    for (const pp of s.product_prices) {
      initial[s.product_id][pp.price_type] = pp.price_inc_gst
    }
  }
  const [prices, setPrices] = useState(initial)

  function set(variantId: string, group: string, val: number) {
    setPrices(prev => ({ ...prev, [variantId]: { ...prev[variantId], [group]: val } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const token = await getAdminToken()
      const results = await Promise.all(
        Object.entries(prices).map(([variantId, groups]) =>
          fetch(`${API}/api/admin/products/${patternId}/variants/${variantId}/prices`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ prices: groups }),
          })
        )
      )
      const failed = results.find(r => !r.ok)
      if (failed) {
        const body = await failed.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${failed.status}`)
      }
      toastSuccess('Prices updated')
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to update prices')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Prices" open={open} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {skus.map(sku => (
            <div key={sku.product_id}>
              <p className="text-sm font-medium text-zinc-800 mb-2">{sku.tyre_size_display}</p>
              {sku.product_prices.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">No prices configured.</p>
              ) : (
                <div className="space-y-2">
                  {sku.product_prices.map((pp, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-600 w-32 capitalize">{pp.price_type.replace('_', ' ')}</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={prices[sku.product_id]?.[pp.price_type] ?? pp.price_inc_gst}
                          onChange={e => set(sku.product_id, pp.price_type, Number(e.target.value))}
                          aria-label={`Price for ${sku.tyre_size_display} — ${pp.price_type}`}
                          className="w-28 pl-6"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100 flex-shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Prices'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit Product Modal ─────────────────────────────────────────────────────

function EditProductModal({ patternId, pattern, open, onClose, onSuccess }: { patternId: string; pattern: PatternInfo; open: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const token = await getAdminToken()
      const res = await fetch(`${API}/api/admin/products/${patternId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patternName:      fd.get('patternName'),
          shortDescription: fd.get('patternShortDescription') || null,
          onSale:           fd.get('onSale') === 'true',
          discountable:     fd.get('discountable') === 'true',
          tags:             fd.get('tags') ? String(fd.get('tags')).split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      toastSuccess('Product updated')
      startTransition(() => onSuccess?.())
      onClose()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  return (
    <Modal title="Edit Product" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="patternName" className="block text-sm font-medium text-zinc-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <Input id="patternName" name="patternName" required defaultValue={pattern.pattern_name} />
          </div>

          <div>
            <label htmlFor="patternShortDescription" className="block text-sm font-medium text-zinc-700 mb-1">Short Description</label>
            <Textarea
              id="patternShortDescription"
              name="patternShortDescription"
              rows={3}
              defaultValue={pattern.pattern_short_description ?? ''}
              className="resize-none"
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-zinc-700 mb-1">
              Tags <span className="text-zinc-400 font-normal">(comma-separated)</span>
            </label>
            <Input
              id="tags"
              name="tags"
              defaultValue={(pattern.tags ?? []).join(', ')}
              placeholder="summer, performance, touring"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="onSale" className="block text-sm font-medium text-zinc-700 mb-1">On Sale</label>
              <select
                id="onSale"
                name="onSale"
                defaultValue={String(pattern.on_sale)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label htmlFor="discountable" className="block text-sm font-medium text-zinc-700 mb-1">Discountable</label>
              <select
                id="discountable"
                name="discountable"
                defaultValue={String(pattern.discountable)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Product Header three-dot menu ──────────────────────────────────────────

function ProductHeaderMenu({ patternId, skuStocks, skuPrices, onSuccess }: Props) {
  const router = useRouter()
  const [open, setOpen]             = useState(false)
  const [showStock, setShowStock]   = useState(false)
  const [showPrices, setShowPrices] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-label="Product options"
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-300 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
            {[
              { label: 'Edit product details', action: () => { setOpen(false); router.push(`/admin/products/${patternId}/edit`) } },
              { label: 'Edit stock levels',    action: () => { setOpen(false); setShowStock(true) } },
              { label: 'Edit prices',          action: () => { setOpen(false); setShowPrices(true) } },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <EditStockModal  patternId={patternId} skus={skuStocks}   open={showStock}  onClose={() => setShowStock(false)}  onSuccess={onSuccess} />
      <EditPricesModal patternId={patternId} skus={skuPrices}   open={showPrices} onClose={() => setShowPrices(false)} onSuccess={onSuccess} />
    </>
  )
}

// ── Variant actions bar (Edit Stock + Edit Prices buttons in Variants table header) ──

export function VariantsTableActions({ patternId, skuStocks, skuPrices, onSuccess }: Omit<Props, 'pattern'>) {
  const [showStock, setShowStock]   = useState(false)
  const [showPrices, setShowPrices] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setShowStock(true)}>
        + Edit Stock Levels
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setShowPrices(true)}>
        + Edit Prices
      </Button>

      <EditStockModal  patternId={patternId} skus={skuStocks} open={showStock}  onClose={() => setShowStock(false)}  onSuccess={onSuccess} />
      <EditPricesModal patternId={patternId} skus={skuPrices} open={showPrices} onClose={() => setShowPrices(false)} onSuccess={onSuccess} />
    </>
  )
}

// ── Variant row three-dot ──────────────────────────────────────────────────

export function VariantRowMenu({ patternId, variantId, variantName, onDeleted }: { patternId: string; variantId: string; variantName: string; onDeleted?: () => void }) {
  const [open, setOpen]         = useState(false)
  const [showDel, setShowDel]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

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
      onDeleted?.()
      setShowDel(false)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to delete variant')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div ref={ref} className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Variant actions"
          onClick={() => setOpen(o => !o)}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
            <Link
              href={`/admin/products/${patternId}/variants/${variantId}/edit`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              Edit Variant
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); setShowDel(true) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete Variant
            </button>
          </div>
        )}
      </div>

      <Dialog open={showDel} onOpenChange={o => { if (!o) setShowDel(false) }}>
        <DialogContent className="rounded-2xl shadow-xl ring-0 bg-white sm:max-w-sm" showCloseButton={false}>
          <DialogTitle className="text-base font-semibold text-zinc-900">Delete Variant</DialogTitle>
          <p className="text-sm text-zinc-600">Delete <strong>{variantName}</strong>? This cannot be undone.</p>
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

// ── Default export: the product header three-dot + all modals ─────────────

export default function ProductActionsBar(props: Props) {
  return <ProductHeaderMenu {...props} />
}

