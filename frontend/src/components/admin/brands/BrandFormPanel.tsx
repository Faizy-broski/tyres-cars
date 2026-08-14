'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Textarea } from '@/components/ui/textarea'
import { toastPromise, toastError } from '@/lib/toast'
import { uploadProductImage } from '@/lib/upload-image'
import { Trash2 } from 'lucide-react'
import type { Brand } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const POSITIONING_OPTIONS = [
  { value: 'budget',     label: 'Budget' },
  { value: 'mid_range',  label: 'Mid Range' },
  { value: 'premium',    label: 'Premium' },
  { value: 'commercial', label: 'Commercial' },
]

export type BrandFormState = {
  brand_name:               string
  brand_slug:               string
  brand_logo:               string
  brand_banner_image:       string
  brand_short_description:  string
  brand_description:        string
  country_of_brand:         string
  manufacturer_name:        string
  brand_positioning:        string
  warranty_info:            string
  seo_title:                string
  seo_description:          string
  is_active:                boolean
  show_on_website:          boolean
  channel_wholesale:        boolean
  channel_retail:           boolean
  channel_marketplaces:     boolean
}

export const EMPTY_BRAND_FORM: BrandFormState = {
  brand_name: '', brand_slug: '', brand_logo: '', brand_banner_image: '',
  brand_short_description: '', brand_description: '', country_of_brand: '',
  manufacturer_name: '', brand_positioning: '', warranty_info: '',
  seo_title: '', seo_description: '', is_active: true, show_on_website: false,
  channel_wholesale: false, channel_retail: false, channel_marketplaces: false,
}

export function brandToForm(b: Brand): BrandFormState {
  return {
    brand_name:              b.brand_name ?? '',
    brand_slug:               b.brand_slug ?? '',
    brand_logo:                b.brand_logo ?? '',
    brand_banner_image:        b.brand_banner_image ?? '',
    brand_short_description:   b.brand_short_description ?? '',
    brand_description:         b.brand_description ?? '',
    country_of_brand:          b.country_of_brand ?? '',
    manufacturer_name:         b.manufacturer_name ?? '',
    brand_positioning:         b.brand_positioning ?? '',
    warranty_info:             b.warranty_info ?? '',
    seo_title:                 b.seo_title ?? '',
    seo_description:           b.seo_description ?? '',
    is_active:                 b.is_active ?? true,
    show_on_website:           b.show_on_website ?? false,
    channel_wholesale:         b.channel_wholesale ?? false,
    channel_retail:            b.channel_retail ?? false,
    channel_marketplaces:      b.channel_marketplaces ?? false,
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
  mode:     'create' | 'edit'
  brandId?: string
  initial:  BrandFormState
  // Passes back the full submitted form alongside the id, so the caller can splice the known-good
  // values straight into the list instantly instead of waiting on a second network round-trip.
  onSaved:  (result: { brandId: string; form: BrandFormState }) => void
  onRequestDelete: () => void
}

export function BrandFormPanel({ mode, brandId, initial, onSaved, onRequestDelete }: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]           = useState<BrandFormState>(initial)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null)
  const logoRef   = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  // Re-sync when a fresh record is loaded into this same panel instance — e.g. right after saving
  // an edit, the panel doesn't remount (its `key` is unchanged since the selected id didn't change),
  // so without this the form would keep showing pre-save values instead of the canonical saved data.
  useEffect(() => { setForm(initial) }, [initial])

  function set<K extends keyof BrandFormState>(key: K, val: BrandFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function uploadImage(file: File, field: 'brand_logo' | 'brand_banner_image', which: 'logo' | 'banner') {
    setUploading(which)
    try {
      const url = await uploadProductImage(file, 'brands')
      set(field, url)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploading(null) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!form.brand_name.trim()) { toastError('Brand name is required'); return }
    if (!form.brand_slug.trim()) { toastError('Slug is required'); return }

    setSaving(true)
    const tok = await getToken()

    const body = {
      brand_name:              form.brand_name.trim(),
      brand_slug:              form.brand_slug.trim(),
      brand_logo:              form.brand_logo              || null,
      brand_banner_image:      form.brand_banner_image      || null,
      brand_short_description: form.brand_short_description || null,
      brand_description:       form.brand_description       || null,
      country_of_brand:        form.country_of_brand        || null,
      manufacturer_name:       form.manufacturer_name       || null,
      brand_positioning:       form.brand_positioning        || null,
      warranty_info:           form.warranty_info            || null,
      seo_title:               form.seo_title               || null,
      seo_description:         form.seo_description         || null,
      is_active:               form.is_active,
      show_on_website:         form.show_on_website,
      channel_wholesale:       form.channel_wholesale,
      channel_retail:          form.channel_retail,
      channel_marketplaces:    form.channel_marketplaces,
    }

    let saved: Brand | undefined
    const req = fetch(
      isEdit ? `${API}/api/admin/products/brands/${brandId}` : `${API}/api/admin/products/brands`,
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(body),
      }
    ).then(async res => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Failed to save brand')
      }
      const json = await res.json() as Brand
      saved = json
      return json
    })

    try {
      await toastPromise(req, {
        loading: isEdit ? 'Saving brand…'  : 'Creating brand…',
        success: isEdit ? 'Brand updated'  : 'Brand created',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to save brand',
      })
      const resolvedId = isEdit ? brandId! : saved?.brand_id
      if (resolvedId) onSaved({ brandId: resolvedId, form: { ...form, brand_name: body.brand_name, brand_slug: body.brand_slug } })
    } catch { /* toasted */ } finally { setSaving(false) }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'
  const sectionHead = 'text-xs font-bold text-zinc-500 uppercase tracking-wide cursor-pointer select-none py-1'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">{isEdit ? 'Edit Brand' : 'Create Brand'}</h2>
          {isEdit && form.brand_slug && <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{form.brand_slug}</p>}
        </div>
        {isEdit && (
          <button type="button" onClick={onRequestDelete} disabled={saving}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 transition-colors"
            title="Delete brand">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          {/* Identity */}
          <div>
            <label className={lbl}>Brand Name <Req /></label>
            <input type="text" required value={form.brand_name}
              onChange={e => { set('brand_name', e.target.value); if (!isEdit) set('brand_slug', slugify(e.target.value)) }}
              placeholder="e.g. Grenlander" className={inp} />
          </div>
          <div>
            <label className={lbl}>Slug <Req /></label>
            <input value={form.brand_slug} onChange={e => set('brand_slug', e.target.value)}
              placeholder="grenlander" required className={`${inp} font-mono`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Country of Brand</label>
              <input type="text" value={form.country_of_brand} onChange={e => set('country_of_brand', e.target.value)} placeholder="e.g. China" className={inp} />
            </div>
            <div>
              <label className={lbl}>Manufacturer</label>
              <input type="text" value={form.manufacturer_name} onChange={e => set('manufacturer_name', e.target.value)} placeholder="e.g. Shandong Linglong" className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Tier</label>
            <select value={form.brand_positioning} onChange={e => set('brand_positioning', e.target.value)} className={inp}>
              <option value="">— None —</option>
              {POSITIONING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Media */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Media Assets</p>
            <ImageField label="Brand Logo URL" value={form.brand_logo} uploading={uploading === 'logo'}
              onChange={v => set('brand_logo', v)} onUploadClick={() => logoRef.current?.click()} inputClass={inp} />
            <input ref={logoRef} type="file" accept="image/*" className="sr-only"
              onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadImage(f, 'brand_logo', 'logo'); e.target.value = '' }} />

            <ImageField label="Brand Banner URL" value={form.brand_banner_image} uploading={uploading === 'banner'}
              onChange={v => set('brand_banner_image', v)} onUploadClick={() => bannerRef.current?.click()} inputClass={inp} />
            <input ref={bannerRef} type="file" accept="image/*" className="sr-only"
              onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadImage(f, 'brand_banner_image', 'banner'); e.target.value = '' }} />
          </div>

          {/* Flags */}
          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <FlagCheckbox id="is_active"       label="Active"          checked={form.is_active}       onChange={v => set('is_active', v)} />
            <FlagCheckbox id="show_on_website" label="Show on Website" checked={form.show_on_website} onChange={v => set('show_on_website', v)} />
          </div>

          {/* Channel permissions */}
          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <p className={sectionHead}>Channel Permissions</p>
            <FlagCheckbox id="channel_wholesale"    label="Wholesale"    checked={form.channel_wholesale}    onChange={v => set('channel_wholesale', v)} />
            <FlagCheckbox id="channel_retail"       label="Retail"       checked={form.channel_retail}       onChange={v => set('channel_retail', v)} />
            <FlagCheckbox id="channel_marketplaces" label="Marketplaces" checked={form.channel_marketplaces} onChange={v => set('channel_marketplaces', v)} />
          </div>

          {/* Collapsible sections — condensed for the narrower panel, but every field remains fully editable */}
          <details className="pt-3 border-t border-zinc-100">
            <summary className={sectionHead}>Description &amp; Copy</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={lbl}>Short Description</label>
                <Textarea value={form.brand_short_description} onChange={e => set('brand_short_description', e.target.value)} rows={2} className="resize-none" />
              </div>
              <div>
                <label className={lbl}>Full Brand Description</label>
                <Textarea value={form.brand_description} onChange={e => set('brand_description', e.target.value)} rows={4} className="resize-none" />
              </div>
              <div>
                <label className={lbl}>Warranty Information</label>
                <Textarea value={form.warranty_info} onChange={e => set('warranty_info', e.target.value)} rows={3} className="resize-none" />
              </div>
            </div>
          </details>

          <details className="pt-3 border-t border-zinc-100">
            <summary className={sectionHead}>SEO</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={lbl}>SEO Title</label>
                <input type="text" value={form.seo_title} onChange={e => set('seo_title', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>SEO Description</label>
                <Textarea value={form.seo_description} onChange={e => set('seo_description', e.target.value)} rows={2} className="resize-none" />
              </div>
            </div>
          </details>
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
            {saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
              : isEdit ? 'Save Changes' : 'Save Brand'
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
