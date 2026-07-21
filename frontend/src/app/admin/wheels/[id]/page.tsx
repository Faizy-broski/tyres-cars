'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Save, ImageOff } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { AdminWheelDetail, AdminWheelVariant, WheelBrand, WheelStyleCategory } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STYLE_CATEGORY_OPTIONS: { value: WheelStyleCategory; label: string }[] = [
  { value: '4x4',        label: '4x4 / Off-Road' },
  { value: 'street',     label: 'Street'          },
  { value: 'luxury',     label: 'Luxury'          },
  { value: 'commercial', label: 'Commercial'      },
]

const STYLE_COLOURS: Record<string, string> = {
  '4x4':      'bg-orange-50 text-orange-700',
  street:     'bg-blue-50 text-blue-700',
  luxury:     'bg-amber-50 text-amber-700',
  commercial: 'bg-purple-50 text-purple-700',
}

// ── Variant dialog ────────────────────────────────────────────────────────────

type VariantFormState = {
  sku:         string
  diameter:    string
  width:       string
  pcd:         string
  offset:      string
  centre_bore: string
  load_rating: string
  price:       string
  is_active:   boolean
}

const EMPTY_VARIANT: VariantFormState = {
  sku: '', diameter: '', width: '', pcd: '', offset: '',
  centre_bore: '', load_rating: '', price: '', is_active: true,
}

function VariantDialog({
  open, onClose, initial, wheelId, token, onSaved,
}: {
  open: boolean
  onClose: () => void
  initial: VariantFormState & { wheel_variant_id?: string }
  wheelId: string
  token: string
  onSaved: (v: AdminWheelVariant) => void
}) {
  const [form, setForm]   = useState<VariantFormState>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(initial) }, [initial, open])

  function set(key: keyof VariantFormState, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit() {
    if (!form.sku.trim())     { toastError('SKU is required'); return }
    if (!form.diameter)       { toastError('Diameter is required'); return }
    if (!form.width)          { toastError('Width is required'); return }
    if (!form.pcd.trim())     { toastError('PCD is required'); return }
    if (form.offset === '')   { toastError('Offset (ET) is required'); return }

    setSaving(true)
    try {
      const isEdit  = Boolean(initial.wheel_variant_id)
      const url = isEdit
        ? `${API}/api/admin/wheels/${wheelId}/variants/${initial.wheel_variant_id}`
        : `${API}/api/admin/wheels/${wheelId}/variants`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sku:         form.sku.trim(),
          diameter:    Number(form.diameter),
          width:       Number(form.width),
          pcd:         form.pcd.trim(),
          offset:      Number(form.offset),
          centre_bore: form.centre_bore ? Number(form.centre_bore) : null,
          load_rating: form.load_rating ? Number(form.load_rating) : null,
          price:       form.price       ? Number(form.price)       : null,
          is_active:   form.is_active,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      const data = isEdit
        ? { ...initial, ...form, wheel_id: wheelId, diameter: Number(form.diameter), width: Number(form.width), offset: Number(form.offset), centre_bore: form.centre_bore ? Number(form.centre_bore) : null, load_rating: form.load_rating ? Number(form.load_rating) : null, price: form.price ? Number(form.price) : null } as AdminWheelVariant
        : await res.json() as AdminWheelVariant
      toastSuccess(isEdit ? 'Variant updated' : 'Variant added')
      onSaved(data)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save variant')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.wheel_variant_id ? 'Edit Variant' : 'Add Variant'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-zinc-700">SKU *</label>
            <Input className="mt-1" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. ENK-RPF1-17-8.5-5114" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-zinc-700">Diameter (inch) *</label>
              <Input type="number" step="0.5" className="mt-1" value={form.diameter} onChange={e => set('diameter', e.target.value)} placeholder="17" />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Width (inch) *</label>
              <Input type="number" step="0.5" className="mt-1" value={form.width} onChange={e => set('width', e.target.value)} placeholder="8.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-zinc-700">PCD *</label>
              <Input className="mt-1" value={form.pcd} onChange={e => set('pcd', e.target.value)} placeholder="5x114.3" />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Offset / ET *</label>
              <Input type="number" className="mt-1" value={form.offset} onChange={e => set('offset', e.target.value)} placeholder="35" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-zinc-700">Centre Bore (mm)</label>
              <Input type="number" step="0.1" className="mt-1" value={form.centre_bore} onChange={e => set('centre_bore', e.target.value)} placeholder="67.1" />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Load Rating (kg)</label>
              <Input type="number" className="mt-1" value={form.load_rating} onChange={e => set('load_rating', e.target.value)} placeholder="750" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Default Price ($)</label>
            <Input type="number" step="0.01" className="mt-1" value={form.price} onChange={e => set('price', e.target.value)} placeholder="349.00" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WheelDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [wheel, setWheel]     = useState<AdminWheelDetail | null>(null)
  const [brands, setBrands]   = useState<WheelBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken]     = useState('')

  // Edit model fields
  const [editForm, setEditForm] = useState<{
    wheel_brand_id:  string
    model_name:      string
    model_slug:      string
    description:     string
    main_image:      string
    gallery_images:  string
    style_category:  string
    finish:          string
    colour:          string
    is_active:       boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // Variant dialog
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [variantInitial, setVariantInitial]       = useState<VariantFormState & { wheel_variant_id?: string }>(EMPTY_VARIANT)
  const [deletingVariant, setDeletingVariant]     = useState<AdminWheelVariant | null>(null)

  const reload = useCallback(async (tok: string) => {
    const res = await fetch(`${API}/api/admin/wheels/${id}`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: AdminWheelDetail = await res.json()
    setWheel(data)
    setEditForm({
      wheel_brand_id: data.wheel_brand_id,
      model_name:     data.model_name,
      model_slug:     data.model_slug,
      description:    data.description    ?? '',
      main_image:     data.main_image     ?? '',
      gallery_images: Array.isArray(data.gallery_images) ? data.gallery_images.join('\n') : (data.gallery_images ?? ''),
      style_category: data.style_category ?? '',
      finish:         data.finish         ?? '',
      colour:         data.colour         ?? '',
      is_active:      data.is_active,
    })
  }, [id])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { session } } = await createClient().auth.getSession()
      const tok = session?.access_token ?? ''
      setToken(tok)
      try {
        const [, brandsRes] = await Promise.all([
          reload(tok),
          fetch(`${API}/api/admin/wheels/brands`, { headers: { Authorization: `Bearer ${tok}` } }),
        ])
        if (brandsRes.ok) setBrands(await brandsRes.json())
      } catch {
        toastError('Failed to load wheel')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, reload])

  async function saveModel() {
    if (!editForm) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/admin/wheels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          wheel_brand_id: editForm.wheel_brand_id,
          model_name:     editForm.model_name.trim(),
          model_slug:     editForm.model_slug.trim(),
          description:    editForm.description.trim()    || null,
          main_image:     editForm.main_image.trim()     || null,
          gallery_images: editForm.gallery_images.trim()
            ? editForm.gallery_images.split('\n').map(u => u.trim()).filter(Boolean)
            : null,
          style_category: editForm.style_category        || null,
          finish:         editForm.finish.trim()         || null,
          colour:         editForm.colour.trim()         || null,
          is_active:      editForm.is_active,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      toastSuccess('Wheel model updated')
      await reload(token)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function deleteWheel() {
    if (!wheel) return
    if (!confirm(`Delete "${wheel.model_name}"? This will fail if variants exist.`)) return
    try {
      const res = await fetch(`${API}/api/admin/wheels/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      toastSuccess('Wheel deleted')
      router.push('/admin/wheels')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  function openAddVariant() {
    setVariantInitial(EMPTY_VARIANT)
    setVariantDialogOpen(true)
  }

  function openEditVariant(v: AdminWheelVariant) {
    setVariantInitial({
      wheel_variant_id: v.wheel_variant_id,
      sku:         v.sku,
      diameter:    String(v.diameter),
      width:       String(v.width),
      pcd:         v.pcd,
      offset:      String(v.offset),
      centre_bore: v.centre_bore != null ? String(v.centre_bore) : '',
      load_rating: v.load_rating != null ? String(v.load_rating) : '',
      price:       v.price       != null ? String(v.price)       : '',
      is_active:   v.is_active,
    })
    setVariantDialogOpen(true)
  }

  function handleVariantSaved(v: AdminWheelVariant) {
    setWheel(prev => {
      if (!prev) return prev
      const variants = prev.wheel_variants ?? []
      const idx = variants.findIndex(x => x.wheel_variant_id === v.wheel_variant_id)
      if (idx >= 0) {
        const next = [...variants]; next[idx] = v
        return { ...prev, wheel_variants: next }
      }
      return { ...prev, wheel_variants: [...variants, v] }
    })
    setVariantDialogOpen(false)
  }

  async function confirmDeleteVariant() {
    if (!deletingVariant) return
    try {
      const res = await fetch(`${API}/api/admin/wheels/${id}/variants/${deletingVariant.wheel_variant_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      setWheel(prev => prev ? { ...prev, wheel_variants: (prev.wheel_variants ?? []).filter(v => v.wheel_variant_id !== deletingVariant.wheel_variant_id) } : prev)
      toastSuccess('Variant deleted')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete variant')
    } finally {
      setDeletingVariant(null)
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

  if (!wheel || !editForm) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Wheels', href: '/admin/wheels' }, { label: 'Wheel' }]} />
        <p className="mt-6 text-sm text-zinc-500">Wheel not found.</p>
      </div>
    )
  }

  const variants = wheel.wheel_variants ?? []

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <AdminBreadcrumb crumbs={[
        { label: 'Wheels', href: '/admin/wheels' },
        { label: wheel.model_name },
      ]} />

      {/* Header */}
      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {wheel.main_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wheel.main_image} alt={wheel.model_name} className="h-16 w-16 object-contain rounded-xl border border-zinc-200" />
          ) : (
            <div className="h-16 w-16 flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 shrink-0">
              <ImageOff className="h-6 w-6 text-zinc-300" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{wheel.model_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-zinc-500">{wheel.wheel_brands?.brand_name}</span>
              {wheel.style_category && (
                <Badge className={STYLE_COLOURS[wheel.style_category] ?? 'bg-zinc-100 text-zinc-600'}>
                  {wheel.style_category}
                </Badge>
              )}
              <Badge className={wheel.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                {wheel.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={deleteWheel}>Delete Wheel</Button>
      </div>

      {/* Edit model card */}
      <div className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-4">Model Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">Brand</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              value={editForm.wheel_brand_id}
              onChange={e => setEditForm(prev => prev ? { ...prev, wheel_brand_id: e.target.value } : prev)}
            >
              {brands.map(b => (
                <option key={b.wheel_brand_id} value={b.wheel_brand_id}>{b.brand_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Style Category</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              value={editForm.style_category}
              onChange={e => setEditForm(prev => prev ? { ...prev, style_category: e.target.value } : prev)}
            >
              <option value="">— None —</option>
              {STYLE_CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Model Name</label>
            <Input className="mt-1" value={editForm.model_name} onChange={e => setEditForm(prev => prev ? { ...prev, model_name: e.target.value } : prev)} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Model Slug</label>
            <Input className="mt-1" value={editForm.model_slug} onChange={e => setEditForm(prev => prev ? { ...prev, model_slug: e.target.value } : prev)} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Finish</label>
            <Input className="mt-1" value={editForm.finish} onChange={e => setEditForm(prev => prev ? { ...prev, finish: e.target.value } : prev)} placeholder="e.g. Matte Black" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Colour</label>
            <Input className="mt-1" value={editForm.colour} onChange={e => setEditForm(prev => prev ? { ...prev, colour: e.target.value } : prev)} placeholder="e.g. Gunmetal" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Main Image URL</label>
            <Input className="mt-1" value={editForm.main_image} onChange={e => setEditForm(prev => prev ? { ...prev, main_image: e.target.value } : prev)} placeholder="https://..." />
            {editForm.main_image.trim() && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={editForm.main_image.trim()}
                alt="Main"
                className="mt-2 h-20 w-20 object-contain rounded-lg border border-zinc-200 bg-zinc-50"
                onError={e => { e.currentTarget.style.display = 'none' }}
                onLoad={e => { e.currentTarget.style.display = 'block' }}
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Gallery Images</label>
            <Textarea className="mt-1" rows={3} value={editForm.gallery_images} onChange={e => setEditForm(prev => prev ? { ...prev, gallery_images: e.target.value } : prev)} placeholder="One URL per line" />
            {editForm.gallery_images.trim() && (
              <div className="mt-2 flex flex-wrap gap-2">
                {editForm.gallery_images.split('\n').map(u => u.trim()).filter(Boolean).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt={`Gallery ${i + 1}`}
                    className="h-16 w-16 object-contain rounded-lg border border-zinc-200 bg-zinc-50"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                    onLoad={e => { e.currentTarget.style.display = 'block' }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={e => setEditForm(prev => prev ? { ...prev, is_active: e.target.checked } : prev)}
                className="rounded"
              />
              Active
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Description</label>
            <Textarea className="mt-1" rows={3} value={editForm.description} onChange={e => setEditForm(prev => prev ? { ...prev, description: e.target.value } : prev)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveModel} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Variants */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-800">
            Variants <span className="text-zinc-400 font-normal">({variants.length})</span>
          </h2>
          <Button size="sm" className="gap-2" onClick={openAddVariant}>
            <Plus className="h-4 w-4" /> Add Variant
          </Button>
        </div>

        {variants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
            No variants yet. Add the first size/PCD combination.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-right">Dia.</th>
                  <th className="px-4 py-3 text-right">Width</th>
                  <th className="px-4 py-3 text-left">PCD</th>
                  <th className="px-4 py-3 text-right">ET</th>
                  <th className="px-4 py-3 text-right">Bore</th>
                  <th className="px-4 py-3 text-right">Load</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {variants.map(v => (
                  <tr key={v.wheel_variant_id} className="even:bg-zinc-50/50 hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{v.sku}</td>
                    <td className="px-4 py-3 text-right text-zinc-600">{v.diameter}&quot;</td>
                    <td className="px-4 py-3 text-right text-zinc-600">{v.width}&quot;</td>
                    <td className="px-4 py-3 text-zinc-600">{v.pcd}</td>
                    <td className="px-4 py-3 text-right text-zinc-600">ET{v.offset}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{v.centre_bore ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{v.load_rating ? `${v.load_rating}kg` : '—'}</td>
                    <td className="px-4 py-3 text-right text-zinc-700 font-medium">
                      {v.price != null ? `$${v.price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={v.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditVariant(v)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeletingVariant(v)}>
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
      </div>

      {/* Variant dialog */}
      <VariantDialog
        open={variantDialogOpen}
        onClose={() => setVariantDialogOpen(false)}
        initial={variantInitial}
        wheelId={id}
        token={token}
        onSaved={handleVariantSaved}
      />

      {/* Delete variant confirm */}
      <Dialog open={Boolean(deletingVariant)} onOpenChange={v => { if (!v) setDeletingVariant(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Variant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            Delete variant <strong>{deletingVariant?.sku}</strong>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingVariant(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteVariant}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
