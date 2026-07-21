'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { WheelBrand } from '@/types/admin.types'

const API   = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const LIMIT = 20

type FormState = {
  brand_name:  string
  logo:        string
  description: string
  is_active:   boolean
}

const EMPTY_FORM: FormState = {
  brand_name:  '',
  logo:        '',
  description: '',
  is_active:   true,
}

function BrandFormDialog({
  open, onClose, initial, token, onSaved,
}: {
  open: boolean
  onClose: () => void
  initial: FormState & { wheel_brand_id?: string }
  token: string
  onSaved: (brand: WheelBrand) => void
}) {
  const [form, setForm]   = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setForm(initial) }, [initial, open])

  function set(key: keyof FormState, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit() {
    if (!form.brand_name.trim()) { toastError('Brand name is required'); return }
    setSaving(true)
    try {
      const isEdit = Boolean(initial.wheel_brand_id)
      const url = isEdit
        ? `${API}/api/admin/wheels/brands/${initial.wheel_brand_id}`
        : `${API}/api/admin/wheels/brands`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brand_name:  form.brand_name.trim(),
          logo:        form.logo.trim() || null,
          description: form.description.trim() || null,
          is_active:   form.is_active,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      const data = await res.json()
      toastSuccess(isEdit ? 'Brand updated' : 'Brand created')
      onSaved(isEdit ? { ...initial, ...form, wheel_brand_id: initial.wheel_brand_id!, created_at: '' } as WheelBrand : data)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save brand')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.wheel_brand_id ? 'Edit Wheel Brand' : 'Add Wheel Brand'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-zinc-700">Brand Name *</label>
            <Input
              className="mt-1"
              value={form.brand_name}
              onChange={e => set('brand_name', e.target.value)}
              placeholder="e.g. Enkei"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Logo URL</label>
            <Input
              ref={logoRef}
              className="mt-1"
              value={form.logo}
              onChange={e => set('logo', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Description</label>
            <Textarea
              className="mt-1"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="rounded"
            />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function WheelBrandsPage() {
  const [brands, setBrands]   = useState<WheelBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken]     = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing]       = useState<(FormState & { wheel_brand_id?: string }) | null>(null)
  const [deleting, setDeleting]     = useState<WheelBrand | null>(null)
  const [page, setPage]             = useState(1)

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

  function openCreate() {
    setEditing({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  function openEdit(b: WheelBrand) {
    setEditing({
      wheel_brand_id: b.wheel_brand_id,
      brand_name:     b.brand_name,
      logo:           b.logo     ?? '',
      description:    b.description ?? '',
      is_active:      b.is_active,
    })
    setDialogOpen(true)
  }

  function handleSaved(saved: WheelBrand) {
    setBrands(prev => {
      const idx = prev.findIndex(b => b.wheel_brand_id === saved.wheel_brand_id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved].sort((a, b) => a.brand_name.localeCompare(b.brand_name))
    })
    setDialogOpen(false)
  }

  const totalPages   = Math.max(1, Math.ceil(brands.length / LIMIT))
  const currentPage  = Math.min(page, totalPages)
  const pagedBrands  = brands.slice((currentPage - 1) * LIMIT, currentPage * LIMIT)

  async function confirmDelete() {
    if (!deleting) return
    try {
      const res = await fetch(`${API}/api/admin/wheels/brands/${deleting.wheel_brand_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      setBrands(prev => prev.filter(b => b.wheel_brand_id !== deleting.wheel_brand_id))
      toastSuccess('Brand deleted')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete brand')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <AdminBreadcrumb crumbs={[
        { label: 'Wheels', href: '/admin/wheels' },
        { label: 'Brands' },
      ]} />

      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Wheel Brands</h1>
          <p className="text-sm text-zinc-500 mt-1">{brands.length} brand{brands.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Brand
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-zinc-100 rounded-lg animate-pulse" />)}
        </div>
      ) : brands.length === 0 ? (
        <div className="mt-12 text-center text-sm text-zinc-400">No wheel brands yet.</div>
      ) : (
        <div className="mt-6 rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {pagedBrands.map(b => (
                <tr key={b.wheel_brand_id} className="odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <div className="flex items-center gap-3">
                      {b.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo} alt={b.brand_name} className="h-8 w-8 object-contain rounded border border-zinc-100" />
                      )}
                      {b.brand_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                    {b.description ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={b.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleting(b)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1 bg-primary text-zinc-900 hover:bg-primary/90" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button size="sm" className="gap-1 bg-primary text-zinc-900 hover:bg-primary/90" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <BrandFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initial={editing}
          token={token}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={Boolean(deleting)} onOpenChange={v => { if (!v) setDeleting(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Brand</DialogTitle>
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

