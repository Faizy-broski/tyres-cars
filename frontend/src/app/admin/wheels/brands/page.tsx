'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WheelBrandFormPanel, EMPTY_WHEEL_BRAND_FORM, brandToForm, type WheelBrandFormState } from '@/components/admin/wheels/WheelBrandFormPanel'
import { Plus } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { WheelBrand } from '@/types/admin.types'

const API   = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const LIMIT = 20

export default function WheelBrandsPage() {
  const [brands, setBrands]             = useState<WheelBrand[]>([])
  const [loading, setLoading]           = useState(true)
  const [token, setToken]               = useState('')
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<WheelBrandFormState | null>(null)
  const [deleting, setDeleting]         = useState<WheelBrand | null>(null)
  const [page, setPage]                 = useState(1)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await createClient().auth.getSession()
      const tok = session?.access_token ?? ''
      setToken(tok)
      try {
        const res = await fetch(`${API}/api/admin/wheels/brands`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setBrands(await res.json())
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load brands')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function selectBrand(b: WheelBrand) {
    setSelectedId(b.wheel_brand_id)
    setSelectedForm(brandToForm(b))
  }

  function handleNewBrand() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  function handleSaved(saved: WheelBrand) {
    setBrands(prev => {
      const idx = prev.findIndex(b => b.wheel_brand_id === saved.wheel_brand_id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved].sort((a, b) => a.brand_name.localeCompare(b.brand_name))
    })
    setSelectedId(saved.wheel_brand_id)
    setSelectedForm(brandToForm(saved))
  }

  const totalPages  = Math.max(1, Math.ceil(brands.length / LIMIT))
  const currentPage = Math.min(page, totalPages)
  const pagedBrands = brands.slice((currentPage - 1) * LIMIT, currentPage * LIMIT)

  async function confirmDelete() {
    if (!deleting) return
    try {
      const res = await fetch(`${API}/api/admin/wheels/brands/${deleting.wheel_brand_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `HTTP ${res.status}`)
      }
      setBrands(prev => prev.filter(b => b.wheel_brand_id !== deleting.wheel_brand_id))
      toastSuccess('Brand deleted')
      if (selectedId === deleting.wheel_brand_id) {
        setSelectedId(null)
        setSelectedForm(null)
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete brand')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb crumbs={[
        { label: 'Wheels', href: '/admin/wheels' },
        { label: 'Brands' },
      ]} />

      <SplitView
        title="Wheel Brands"
        description="Manage wheel manufacturers and logos"
        panelWidthClassName="w-full lg:w-[420px] xl:w-[460px]"
        headerAction={
          <button
            type="button"
            onClick={handleNewBrand}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Brand
          </button>
        }
        list={
          loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Brand</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {brands.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-12 text-center text-sm text-zinc-400">
                          No wheel brands yet.
                        </td>
                      </tr>
                    ) : (
                      pagedBrands.map(b => {
                        const isSelected = selectedId === b.wheel_brand_id
                        return (
                          <tr
                            key={b.wheel_brand_id}
                            className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                              isSelected ? '!bg-primary/10' : ''
                            }`}
                            onClick={() => selectBrand(b)}
                          >
                            <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {b.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={b.logo}
                                    alt={b.brand_name}
                                    className="h-8 w-8 object-contain rounded border border-zinc-100 bg-zinc-50 p-0.5 shrink-0"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded border border-zinc-100 bg-zinc-50 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                                    {b.brand_name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-semibold text-zinc-900">{b.brand_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap max-w-[260px] truncate" title={b.description ?? ''}>
                              {b.description ?? '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge className={b.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                                {b.is_active ? 'Active' : 'Inactive'}
                              </Badge>
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
                  <span>{brands.length} total brands</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 font-medium text-zinc-700">{currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        }
        panel={
          <WheelBrandFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            wheelBrandId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_WHEEL_BRAND_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const b = brands.find(x => x.wheel_brand_id === selectedId)
              if (b) setDeleting(b)
            }}
          />
        }
      />

      {/* Delete confirm dialog */}
      <Dialog open={Boolean(deleting)} onOpenChange={v => { if (!v) setDeleting(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Brand?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            Delete <strong>{deleting?.brand_name}</strong>? This will fail if wheels are linked to this brand.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
