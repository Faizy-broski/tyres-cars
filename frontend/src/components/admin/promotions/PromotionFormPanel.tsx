'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toastPromise, toastError } from '@/lib/toast'
import { Trash2 } from 'lucide-react'
import type { PromotionRow } from '@/lib/query/hooks'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type PromotionFormState = {
  title:             string
  brand_name:        string
  description:       string
  cta_url:           string
  discount_type:     'percent' | 'fixed_amount' | 'bundle'
  discount_value:    string
  start_date:        string
  end_date:          string
  applies_to:        string
  target_id:         string
  minimum_qty:       string
  display_order:     string
  show_on_homepage:  boolean
  is_active:         boolean
  image_url:         string
}

export const EMPTY_PROMOTION_FORM: PromotionFormState = {
  title: '', brand_name: '', description: '', cta_url: '',
  discount_type: 'percent', discount_value: '0',
  start_date: '', end_date: '',
  applies_to: 'brand', target_id: '',
  minimum_qty: '1', display_order: '0',
  show_on_homepage: true, is_active: true, image_url: '',
}

export function promotionToForm(p: PromotionRow): PromotionFormState {
  return {
    title:             p.title ?? '',
    brand_name:        p.brand_name ?? '',
    description:       p.description ?? '',
    cta_url:           p.cta_url ?? '',
    discount_type:     p.discount_type ?? 'percent',
    discount_value:    p.discount_value != null ? String(p.discount_value) : '0',
    start_date:        p.start_date ?? '',
    end_date:          p.end_date ?? '',
    applies_to:        p.applies_to ?? 'brand',
    target_id:         p.target_id ?? '',
    minimum_qty:       p.minimum_qty != null ? String(p.minimum_qty) : '1',
    display_order:     p.display_order != null ? String(p.display_order) : '0',
    show_on_homepage:  p.show_on_homepage ?? true,
    is_active:         p.is_active ?? true,
    image_url:         p.image_url ?? '',
  }
}

type Brand    = { brand_id: string; brand_name: string }
type Category = { category_id: string; category_name: string; category_type: string }

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

async function uploadImage(file: File, promotionId: string): Promise<string> {
  const ext    = file.name.split('.').pop() ?? 'jpg'
  const path   = `deals/${promotionId}/hero.${ext}`
  const client = createClient()

  const { error } = await client.storage
    .from('product-images')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(`Image upload failed: ${error.message}`)

  const { data } = client.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

interface Props {
  mode:          'create' | 'edit'
  promotionId?:  string
  initial:       PromotionFormState
  onSaved:       (result: { promotionId: string }) => void
  onRequestDelete: () => void
}

export function PromotionFormPanel({ mode, promotionId, initial, onSaved, onRequestDelete }: Props) {
  const isEdit = mode === 'edit'
  const [values, setValues]         = useState<PromotionFormState>(initial)
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [preview, setPreview]       = useState<string>(initial.image_url ?? '')
  const [saving, setSaving]         = useState(false)

  const [brands, setBrands]         = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [metaLoaded, setMetaLoaded] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function loadMeta() {
      try {
        const tok = await getToken()
        const res = await fetch(`${API}/api/admin/products/meta`, { headers: { Authorization: `Bearer ${tok}` } })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) {
          setBrands(json.brands ?? [])
          setCategories(json.categories ?? [])
          setMetaLoaded(true)
        }
      } catch { /* non-fatal — text fallback still shown */ }
    }
    loadMeta()
    return () => { cancelled = true }
  }, [])

  function set<K extends keyof PromotionFormState>(key: K, val: PromotionFormState[K]) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  function onScopeChange(newScope: string) {
    setValues(prev => ({ ...prev, applies_to: newScope, target_id: '' }))
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toastError('Image must be under 5 MB'); return }
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (Number(values.discount_value) <= 0) { toastError('Discount value must be greater than 0'); return }
    if (values.end_date < values.start_date) { toastError('End date must be on or after start date'); return }

    setSaving(true)
    try {
      const tok     = await getToken()
      const headers = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }

      const body = {
        title:            values.title,
        brand_name:       values.brand_name  || null,
        description:      values.description || null,
        cta_url:          values.cta_url     || null,
        discount_type:    values.discount_type,
        discount_value:   Number(values.discount_value),
        start_date:       values.start_date,
        end_date:         values.end_date,
        applies_to:       values.applies_to,
        target_id:        values.target_id   || null,
        minimum_qty:      Number(values.minimum_qty),
        display_order:    Number(values.display_order),
        show_on_homepage: values.show_on_homepage,
        is_active:        values.is_active,
        image_url:        values.image_url   || null,
      }

      let pid = promotionId

      if (!isEdit) {
        const res  = await fetch(`${API}/api/admin/promotions`, { method: 'POST', headers, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Create failed (${res.status})`)
        const json = await res.json()
        pid = json.promotion_id
      } else {
        const res = await fetch(`${API}/api/admin/promotions/${pid}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Update failed (${res.status})`)
      }

      if (imageFile && pid) {
        const url      = await uploadImage(imageFile, pid)
        const patchRes = await fetch(`${API}/api/admin/promotions/${pid}`, { method: 'PATCH', headers, body: JSON.stringify({ image_url: url }) })
        if (!patchRes.ok) toastError('Promotion saved but image URL could not be updated')
      }

      if (pid) onSaved({ promotionId: pid })
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'
  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const sectionHead = 'text-xs font-bold text-zinc-500 uppercase tracking-wide cursor-pointer select-none py-1'

  function TargetSelector() {
    const scope = values.applies_to

    if (scope === 'brand') {
      return (
        <div>
          <label className={lbl}>Brand <Req /></label>
          {!metaLoaded ? (
            <div className="h-[38px] animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <select required className={inp} value={values.target_id} onChange={e => set('target_id', e.target.value)}>
              <option value="">— Select brand —</option>
              {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
            </select>
          )}
        </div>
      )
    }
    if (scope === 'category') {
      return (
        <div>
          <label className={lbl}>Category <Req /></label>
          {!metaLoaded ? (
            <div className="h-[38px] animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <select required className={inp} value={values.target_id} onChange={e => set('target_id', e.target.value)}>
              <option value="">— Select category —</option>
              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}{c.category_type ? ` (${c.category_type})` : ''}</option>)}
            </select>
          )}
        </div>
      )
    }
    if (scope === 'product') {
      return (
        <div>
          <label className={lbl}>Product ID (UUID)</label>
          <input className={inp} value={values.target_id} onChange={e => set('target_id', e.target.value)} placeholder="Paste the product UUID" />
        </div>
      )
    }
    if (scope === 'pattern') {
      return (
        <div>
          <label className={lbl}>Pattern ID (UUID)</label>
          <input className={inp} value={values.target_id} onChange={e => set('target_id', e.target.value)} placeholder="Paste the pattern UUID" />
        </div>
      )
    }
    if (scope === 'customer_group') {
      return (
        <div>
          <label className={lbl}>Customer Group ID</label>
          <input className={inp} value={values.target_id} onChange={e => set('target_id', e.target.value)} placeholder="Leave blank for all customers" />
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">{isEdit ? 'Edit Promotion' : 'Create Promotion'}</h2>
        {isEdit && (
          <button type="button" onClick={onRequestDelete}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
            title="Delete promotion">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          <div>
            <label className={lbl}>Title <Req /></label>
            <input required value={values.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Up to Rs. 5,000 Off" className={inp} />
          </div>
          <div>
            <label className={lbl}>Brand pill label</label>
            <input value={values.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="Shown on the deal card" className={inp} />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <input value={values.description} onChange={e => set('description', e.target.value)} placeholder="Short subtitle on the card" className={inp} />
          </div>

          {/* Hero image */}
          <div className="pt-3 border-t border-zinc-100 space-y-2">
            <p className={sectionHead}>Hero Image</p>
            <div className="flex items-center gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="h-16 w-14 object-cover rounded-lg border border-zinc-200 shrink-0" />
              ) : (
                <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 text-[10px] text-center p-1">No image</div>
              )}
              <div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  {preview ? 'Change image' : 'Upload image'}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Discount</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Type <Req /></label>
                <select required className={inp} value={values.discount_type} onChange={e => set('discount_type', e.target.value as PromotionFormState['discount_type'])}>
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed_amount">Fixed Amount</option>
                  <option value="bundle">Bundle</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Value <Req /></label>
                <input required type="number" min="0.01" step="0.01" className={inp} value={values.discount_value} onChange={e => set('discount_value', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Active Period</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Start date <Req /></label>
                <input required type="date" className={inp} value={values.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>End date <Req /></label>
                <input required type="date" className={inp} value={values.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Scope */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Discount Scope</p>
            <div>
              <label className={lbl}>Applies to</label>
              <select className={inp} value={values.applies_to} onChange={e => onScopeChange(e.target.value)}>
                <option value="brand">Brand — all products from a brand</option>
                <option value="product">Product — a single tyre product</option>
                <option value="pattern">Pattern — all sizes of a tyre pattern</option>
                <option value="category">Category — a product category</option>
                <option value="customer_group">Customer Group</option>
              </select>
            </div>
            <TargetSelector />
          </div>

          {/* Flags */}
          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <FlagCheckbox id="show_on_homepage" label="Show on homepage carousel" checked={values.show_on_homepage} onChange={v => set('show_on_homepage', v)} />
            <FlagCheckbox id="is_active"        label="Active (discount applies at checkout)" checked={values.is_active} onChange={v => set('is_active', v)} />
          </div>

          {/* Collapsible advanced */}
          <details className="pt-3 border-t border-zinc-100">
            <summary className={sectionHead}>Advanced</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={lbl}>CTA URL</label>
                <input type="url" value={values.cta_url} onChange={e => set('cta_url', e.target.value)} placeholder="https://… (makes deal card clickable)" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Minimum qty</label>
                  <input type="number" min="1" step="1" className={inp} value={values.minimum_qty} onChange={e => set('minimum_qty', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Display order</label>
                  <input type="number" min="0" step="1" className={inp} value={values.display_order} onChange={e => set('display_order', e.target.value)} />
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
            {saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
              : isEdit ? 'Save Changes' : 'Save Promotion'
            }
          </button>
        </div>
      </form>
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
