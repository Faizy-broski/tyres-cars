'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/badge'
import { BoolToggle } from '@/components/admin/BoolToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { Category } from '@/types/admin.types'
import { uploadProductImage } from '@/lib/upload-image'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CATEGORY_TYPES = [
  { value: 'season',      label: 'Season' },
  { value: 'application', label: 'Application' },
  { value: 'performance', label: 'Performance' },
  { value: 'position',    label: 'Position' },
  { value: 'terrain',     label: 'Terrain' },
]

const TYPE_COLOURS: Record<string, string> = {
  season:      'bg-blue-50 text-blue-700',
  application: 'bg-green-50 text-green-700',
  performance: 'bg-amber-50 text-amber-700',
  position:    'bg-purple-50 text-purple-700',
  terrain:     'bg-orange-50 text-orange-700',
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

type FormState = {
  category_name:        string
  category_slug:        string
  category_type:        string
  parent_category_id:   string
  description:          string
  image:                string
  sort_order:           string
  is_active:            boolean
  hidden_from_website:  boolean
}

const EMPTY_FORM: FormState = {
  category_name:       '',
  category_slug:       '',
  category_type:       'application',
  parent_category_id:  '',
  description:         '',
  image:               '',
  sort_order:          '',
  is_active:           true,
  hidden_from_website: false,
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const imageRef = useRef<HTMLInputElement>(null)

  useEffect(() => { document.title = 'Categories | Tyres & Car Valeting' }, [])

  async function fetchCategories() {
    setLoading(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/products/categories`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Failed to load categories')
      setCategories(await res.json())
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  function openCreate() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(cat: Category) {
    setEditTarget(cat)
    setForm({
      category_name:       cat.category_name,
      category_slug:       cat.category_slug,
      category_type:       cat.category_type,
      parent_category_id:  cat.parent_category_id ?? '',
      description:         cat.description ?? '',
      image:               cat.image ?? '',
      sort_order:          cat.sort_order != null ? String(cat.sort_order) : '',
      is_active:           cat.is_active,
      hidden_from_website: cat.hidden_from_website,
    })
    setDialogOpen(true)
  }

  async function handleImageUpload(file: File) {
    setImageUploading(true)
    try {
      const url = await uploadProductImage(file, 'categories')
      setForm(f => ({ ...f, image: url }))
    } catch {
      toastError('Image upload failed')
    } finally {
      setImageUploading(false)
    }
  }

  async function handleSave() {
    if (!form.category_name.trim()) return toastError('Category name is required')
    if (!form.category_slug.trim()) return toastError('Slug is required')
    if (!form.category_type)        return toastError('Category type is required')

    setSaving(true)
    try {
      const tok = await getToken()
      const payload: Record<string, unknown> = {
        category_name:       form.category_name.trim(),
        category_slug:       form.category_slug.trim(),
        category_type:       form.category_type,
        parent_category_id:  form.parent_category_id || null,
        description:         form.description || null,
        image:               form.image || null,
        sort_order:          form.sort_order !== '' ? Number(form.sort_order) : null,
        is_active:           form.is_active,
        hidden_from_website: form.hidden_from_website,
      }

      const url    = editTarget
        ? `${API}/api/admin/products/categories/${editTarget.category_id}`
        : `${API}/api/admin/products/categories`
      const method = editTarget ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Save failed')
      }
      toastSuccess(editTarget ? 'Category updated' : 'Category created')
      setDialogOpen(false)
      fetchCategories()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/products/categories/${deleteTarget.category_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      toastSuccess('Category deleted')
      setDeleteTarget(null)
      fetchCategories()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const parentOptions = categories.filter(c => !editTarget || c.category_id !== editTarget.category_id)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <AdminBreadcrumb crumbs={[{ label: 'Products', href: '/admin/products' }, { label: 'Categories' }]} />
          <h1 className="mt-2 text-xl font-semibold text-zinc-900">Categories</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage season, application, performance, position and terrain categories</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Parent</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Order</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 [&_tr:nth-child(even)]:bg-zinc-100 [&_tr:nth-child(odd)]:bg-white [&_tr:hover]:bg-amber-50 [&_tr]:transition-colors">
              {categories.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">No categories yet</td></tr>
              )}
              {categories.map(cat => {
                const parent = categories.find(c => c.category_id === cat.parent_category_id)
                return (
                  <tr key={cat.category_id} className="even:bg-zinc-50/50 hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {cat.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cat.image} alt="" className="w-7 h-7 rounded object-cover border border-zinc-200" />
                        )}
                        <span className="font-medium text-zinc-900">{cat.category_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{cat.category_slug}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_COLOURS[cat.category_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {cat.category_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{parent?.category_name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{cat.sort_order ?? '—'}</td>
                    <td className="px-4 py-3">
                      <BoolToggle initial={cat.is_active} onToggle={async next => {
                        const tok = await getToken()
                        const res = await fetch(`${API}/api/admin/products/categories/${cat.category_id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                          body: JSON.stringify({ is_active: next }),
                        })
                        if (!res.ok) throw new Error('Failed')
                        fetchCategories()
                      }} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => openEdit(cat)} className="text-zinc-400 hover:text-zinc-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(cat)} className="text-zinc-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Name + Slug */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Name <span className="text-red-500">*</span></label>
                <Input
                  value={form.category_name}
                  onChange={e => setForm(f => ({ ...f, category_name: e.target.value, category_slug: editTarget ? f.category_slug : slugify(e.target.value) }))}
                  placeholder="All Terrain"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Slug <span className="text-red-500">*</span></label>
                <Input
                  value={form.category_slug}
                  onChange={e => setForm(f => ({ ...f, category_slug: slugify(e.target.value) }))}
                  placeholder="all-terrain"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Type <span className="text-red-500">*</span></label>
              <select
                value={form.category_type}
                onChange={e => setForm(f => ({ ...f, category_type: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                {CATEGORY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Parent */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Parent Category</label>
              <select
                value={form.parent_category_id}
                onChange={e => setForm(f => ({ ...f, parent_category_id: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                <option value="">None (top-level)</option>
                {parentOptions.map(c => (
                  <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Description</label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Category page content…"
                rows={3}
              />
            </div>

            {/* Image */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Image</label>
              <div className="flex gap-2 items-start">
                {form.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image} alt="" className="w-14 h-14 rounded-lg object-cover border border-zinc-200 shrink-0" />
                )}
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={form.image}
                    onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                    placeholder="https://… or upload below"
                  />
                  <button
                    type="button"
                    onClick={() => imageRef.current?.click()}
                    disabled={imageUploading}
                    className="text-xs text-primary underline hover:no-underline disabled:opacity-50"
                  >
                    {imageUploading ? 'Uploading…' : 'Upload image'}
                  </button>
                  <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                </div>
              </div>
            </div>

            {/* Sort Order */}
            <div className="max-w-[160px]">
              <label className="block text-xs font-medium text-zinc-700 mb-1">Sort Order</label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                placeholder="0"
                min={0}
                step={1}
              />
              <p className="mt-1 text-xs text-zinc-400">Lower numbers appear first.</p>
            </div>

            {/* Active + Hidden from Website */}
            <div className="flex flex-col gap-3">
              <label className="block text-xs font-medium text-zinc-700">Visibility</label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 accent-primary cursor-pointer"
                />
                <span className="text-sm text-zinc-700">Active</span>
                <span className="text-xs text-zinc-400">(assignable to products)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.hidden_from_website}
                  onChange={e => setForm(f => ({ ...f, hidden_from_website: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 accent-primary cursor-pointer"
                />
                <span className="text-sm text-zinc-700">Hidden from Website</span>
                <span className="text-xs text-zinc-400">(not shown on storefront)</span>
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="button" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Category'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            <strong>{deleteTarget?.category_name}</strong> will be permanently removed and unlinked from all products.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

