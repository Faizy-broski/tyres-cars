'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toastPromise, toastError } from '@/lib/toast'
import { uploadProductImage } from '@/lib/upload-image'
import { CreatableCombobox } from '@/components/ui/CreatableCombobox'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CATEGORY_TYPES = ['season', 'application', 'performance', 'position', 'terrain'] as const
type CategoryType = typeof CATEGORY_TYPES[number]

interface Category {
  category_id:        string
  parent_category_id: string | null
  category_name:      string
  category_slug:      string
  category_type:      CategoryType
  description:        string | null
  image:              string | null
  sort_order:         number | null
  is_active:          boolean
}

type FormState = {
  category_name:        string
  category_slug:        string
  category_type:        CategoryType
  parent_category_id:   string
  description:          string
  image:                string
  sort_order:           string
  is_active:            boolean
  hidden_from_website:  boolean
}

const EMPTY: FormState = {
  category_name: '', category_slug: '', category_type: 'application',
  parent_category_id: '', description: '', image: '', sort_order: '',
  is_active: true, hidden_from_website: false,
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function NewCategoryPage() {
  const router = useRouter()
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [token, setToken]           = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const imgRef = useRef<HTMLInputElement>(null)

  useEffect(() => { document.title = 'New Category | Tyres & Car Valeting' }, [])

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        setToken(tok)
        const res = await fetch(`${API}/api/admin/products/categories`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (res.ok) setCategories(await res.json())
      } catch {
        toastError('Failed to load categories')
      }
    }
    load()
  }, [])

  function set(key: keyof FormState, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const url = await uploadProductImage(file, 'categories')
      set('image', url)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category_name.trim()) { toastError('Category name is required'); return }
    if (!form.category_slug.trim()) { toastError('Slug is required'); return }

    setSaving(true)
    const body = {
      category_name:       form.category_name.trim(),
      category_slug:       form.category_slug.trim(),
      category_type:       form.category_type,
      parent_category_id:  form.parent_category_id || null,
      description:         form.description        || null,
      image:               form.image              || null,
      sort_order:          form.sort_order !== '' ? Number(form.sort_order) : null,
      is_active:           form.is_active,
      hidden_from_website: form.hidden_from_website,
    }

    const req = fetch(`${API}/api/admin/products/categories`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    }).then(async res => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Failed to save')
      }
      return res.json()
    })

    try {
      await toastPromise(req, {
        loading: 'Creating category…',
        success: 'Category created',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to save',
      })
      router.push('/admin/products/categories')
    } catch { /* shown */ } finally { setSaving(false) }
  }

  const inp = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white'
  const lbl = 'block text-sm font-medium text-zinc-700 mb-1'

  const parentOptions = categories.filter(c => c.category_type === form.category_type)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <AdminBreadcrumb crumbs={[
        { label: 'Products', href: '/admin/products' },
        { label: 'Categories', href: '/admin/products/categories' },
        { label: 'New Category' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-zinc-900">New Category</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Add a new tyre category to organise your product catalogue</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-6">

        {/* Name + Slug */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Category Name <span className="text-red-500">*</span></label>
            <Input
              value={form.category_name}
              onChange={e => {
                set('category_name', e.target.value)
                set('category_slug', slugify(e.target.value))
              }}
              placeholder="e.g. All Terrain"
              required
              autoFocus
            />
          </div>
          <div>
            <label className={lbl}>Slug <span className="text-red-500">*</span></label>
            <div className="flex items-center rounded-lg border border-zinc-300 overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
              <span className="px-2 text-zinc-400 text-sm select-none border-r border-zinc-300 bg-zinc-50 py-2">/</span>
              <input
                value={form.category_slug}
                onChange={e => set('category_slug', e.target.value)}
                placeholder="all-terrain"
                required
                className="flex-1 px-3 py-2 text-sm focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Type + Parent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Category Type <span className="text-red-500">*</span></label>
            <CreatableCombobox
              options={CATEGORY_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
              value={form.category_type}
              onChange={v => { set('category_type', v as typeof CATEGORY_TYPES[number]); set('parent_category_id', '') }}
              placeholder="Select type…"
            />
          </div>
          <div>
            <label className={lbl}>Parent Category</label>
            <CreatableCombobox
              options={[
                { value: '', label: '— None (top-level) —' },
                ...parentOptions.map(c => ({ value: c.category_id, label: c.category_name })),
              ]}
              value={form.parent_category_id}
              onChange={v => set('parent_category_id', v)}
              placeholder="Search parent category…"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={lbl}>Description</label>
          <Textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            placeholder="Category page content shown on the website…"
            className="resize-none"
          />
        </div>

        {/* Image */}
        <div>
          <label className={lbl}>Category Image</label>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadImage(f); e.target.value = '' }}
          />
          {form.image ? (
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.image} alt="" className="h-14 w-14 object-cover rounded-lg border border-zinc-200 shrink-0" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => imgRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Replace'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => set('image', '')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imgRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-2.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors mb-2"
            >
              {uploading ? 'Uploading…' : '+ Upload Image'}
            </button>
          )}
          <Input
            value={form.image}
            onChange={e => set('image', e.target.value)}
            placeholder="https://cdn.example.com/category.jpg"
            className="text-sm"
          />
        </div>

        {/* Sort Order */}
        <div className="max-w-[200px]">
          <label className={lbl}>Sort Order</label>
          <Input
            type="number"
            min={0}
            step={1}
            value={form.sort_order}
            onChange={e => set('sort_order', e.target.value)}
            placeholder="0"
            className="text-sm"
          />
          <p className="mt-1 text-xs text-zinc-400">Lower numbers appear first on the frontend.</p>
        </div>

        {/* Active + Hidden from Website */}
        <div className="flex flex-col gap-3">
          <label className={lbl}>Visibility</label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-primary accent-primary cursor-pointer"
            />
            <span className="text-sm text-zinc-700">Active</span>
            <span className="text-xs text-zinc-400">(assignable to products)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.hidden_from_website}
              onChange={e => set('hidden_from_website', e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-primary accent-primary cursor-pointer"
            />
            <span className="text-sm text-zinc-700">Hidden from Website</span>
            <span className="text-xs text-zinc-400">(not shown on storefront)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/products/categories')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create Category'}
          </Button>
        </div>
      </form>
    </div>
  )
}

