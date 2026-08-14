'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Textarea } from '@/components/ui/textarea'
import { toastPromise, toastError } from '@/lib/toast'
import { uploadProductImage } from '@/lib/upload-image'
import { Trash2 } from 'lucide-react'
import type { Category, CategoryType } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CATEGORY_TYPES: CategoryType[] = ['season', 'application', 'performance', 'position', 'terrain']

export type CategoryFormState = {
  category_name:        string
  category_slug:        string
  category_type:        CategoryType
  parent_category_id:   string
  description:          string
  image:                string
  sort_order:           string
  is_active:             boolean
  hidden_from_website:   boolean
}

export const EMPTY_CATEGORY_FORM: CategoryFormState = {
  category_name: '', category_slug: '', category_type: 'application',
  parent_category_id: '', description: '', image: '', sort_order: '',
  is_active: true, hidden_from_website: false,
}

export function categoryToForm(c: Category): CategoryFormState {
  return {
    category_name:        c.category_name ?? '',
    category_slug:        c.category_slug ?? '',
    category_type:        (c.category_type as CategoryType) ?? 'application',
    parent_category_id:   c.parent_category_id ?? '',
    description:          c.description ?? '',
    image:                c.image ?? '',
    sort_order:            c.sort_order != null ? String(c.sort_order) : '',
    is_active:             c.is_active ?? true,
    hidden_from_website:   c.hidden_from_website ?? false,
  }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:        'create' | 'edit'
  categoryId?: string
  categories:  Category[]  // for the parent-category dropdown
  initial:     CategoryFormState
  // Passes back the full submitted form alongside the id, so the caller can splice the known-good
  // values straight into the list instantly instead of waiting on a second network round-trip.
  onSaved:     (result: { categoryId: string; form: CategoryFormState }) => void
  onRequestDelete: () => void
}

export function CategoryFormPanel({ mode, categoryId, categories, initial, onSaved, onRequestDelete }: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]           = useState<CategoryFormState>(initial)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)

  // Re-sync when a fresh record is loaded into this same panel instance — e.g. right after saving
  // an edit, the panel doesn't remount (its `key` is unchanged since the selected id didn't change),
  // so without this the form would keep showing pre-save values instead of the canonical saved data.
  useEffect(() => { setForm(initial) }, [initial])

  function set<K extends keyof CategoryFormState>(key: K, val: CategoryFormState[K]) {
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

  // Only offer parent options of the same type, excluding self
  const parentOptions = categories.filter(c =>
    c.category_type === form.category_type && c.category_id !== categoryId
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!form.category_name.trim()) { toastError('Category name is required'); return }
    if (!form.category_slug.trim()) { toastError('Slug is required'); return }

    setSaving(true)
    const tok = await getToken()

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

    let saved: Category | undefined
    const req = fetch(
      isEdit ? `${API}/api/admin/products/categories/${categoryId}` : `${API}/api/admin/products/categories`,
      {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body:    JSON.stringify(body),
      }
    ).then(async res => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Failed to save category')
      }
      const json = await res.json() as Category
      saved = json
      return json
    })

    try {
      await toastPromise(req, {
        loading: isEdit ? 'Saving category…'  : 'Creating category…',
        success: isEdit ? 'Category updated'  : 'Category created',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to save category',
      })
      const resolvedId = isEdit ? categoryId! : saved?.category_id
      if (resolvedId) onSaved({ categoryId: resolvedId, form: { ...form, category_name: body.category_name, category_slug: body.category_slug } })
    } catch { /* toasted */ } finally { setSaving(false) }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'
  const sectionHead = 'text-xs font-bold text-zinc-500 uppercase tracking-wide cursor-pointer select-none py-1'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">{isEdit ? 'Edit Category' : 'Create Category'}</h2>
          {isEdit && form.category_slug && <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{form.category_slug}</p>}
        </div>
        {isEdit && (
          <button type="button" onClick={onRequestDelete} disabled={saving}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 transition-colors"
            title="Delete category">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          <div>
            <label className={lbl}>Category Name <Req /></label>
            <input type="text" required value={form.category_name}
              onChange={e => { set('category_name', e.target.value); if (!isEdit) set('category_slug', slugify(e.target.value)) }}
              placeholder="e.g. All Terrain" className={inp} />
          </div>
          <div>
            <label className={lbl}>Slug <Req /></label>
            <input value={form.category_slug} onChange={e => set('category_slug', e.target.value)}
              placeholder="all-terrain" required className={`${inp} font-mono`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Type <Req /></label>
              <select value={form.category_type}
                onChange={e => { set('category_type', e.target.value as CategoryType); set('parent_category_id', '') }}
                className={inp} required>
                {CATEGORY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Parent Category</label>
              <select value={form.parent_category_id} onChange={e => set('parent_category_id', e.target.value)} className={inp}>
                <option value="">— None (top-level) —</option>
                {parentOptions.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Sort Order</label>
            <input type="number" min={0} step={1} value={form.sort_order} onChange={e => set('sort_order', e.target.value)}
              placeholder="0" className={inp} />
            <p className="mt-1 text-xs text-zinc-400">Lower numbers appear first on the frontend.</p>
          </div>

          {/* Media */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Media</p>
            <ImageField label="Category Image URL" value={form.image} uploading={uploading}
              onChange={v => set('image', v)} onUploadClick={() => imgRef.current?.click()} inputClass={inp} />
            <input ref={imgRef} type="file" accept="image/*" className="sr-only"
              onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadImage(f); e.target.value = '' }} />
          </div>

          {/* Flags */}
          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <FlagCheckbox id="is_active"            label="Active (assignable to products)" checked={form.is_active}           onChange={v => set('is_active', v)} />
            <FlagCheckbox id="hidden_from_website"   label="Hidden from Website"              checked={form.hidden_from_website} onChange={v => set('hidden_from_website', v)} />
          </div>

          {/* Collapsible */}
          <details className="pt-3 border-t border-zinc-100">
            <summary className={sectionHead}>Description</summary>
            <div className="mt-3">
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
                placeholder="Category page content shown on the website…" className="resize-none" />
            </div>
          </details>
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
            {saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
              : isEdit ? 'Save Changes' : 'Save Category'
            }
          </button>
        </div>
      </form>
    </div>
  )
}

function ImageField({ label, value, uploading, onChange, onUploadClick, inputClass }: {
  label: string; value: string; uploading: boolean
  onChange: (v: string) => void; onUploadClick: () => void; inputClass: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-9 w-9 object-contain rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 shrink-0" />
        )}
        <input type="url" value={value} onChange={e => onChange(e.target.value)} placeholder="https://…" className={inputClass} />
        <button type="button" onClick={onUploadClick} disabled={uploading}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
          {uploading ? '…' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

function FlagCheckbox({ id, label, checked, onChange }: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 text-sm text-zinc-700 cursor-pointer select-none">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/30 focus:ring-2" />
      {label}
    </label>
  )
}

function Req() { return <span className="text-red-500 ml-0.5">*</span> }
