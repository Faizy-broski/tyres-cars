'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Textarea } from '@/components/ui/textarea'
import { toastPromise, toastError } from '@/lib/toast'
import { uploadProductImage } from '@/lib/upload-image'
import { Trash2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreatableCombobox, ComboOption } from '@/components/ui/CreatableCombobox'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type PatternFormState = {
  pattern_name:              string
  pattern_slug:              string
  pattern_short_description: string
  pattern_description:       string
  main_image:                string
  tread_image:                string
  application_type:          string
  season_type:                string
  performance_category:      string
  position_category:         string
  shoulder_type:             string
  terrain_type:               string
  default_country_of_origin: string
  warranty_km:                string
  seo_title:                  string
  seo_description:            string
  tyre_overview:               string
  features:                    string
  warranty_information:        string
  is_active:                  boolean
  show_on_website:            boolean
  on_sale:                    boolean
  discountable:                boolean
  category_ids:                string[]
}

export const EMPTY_PATTERN_FORM: PatternFormState = {
  pattern_name: '', pattern_slug: '', pattern_short_description: '', pattern_description: '',
  main_image: '', tread_image: '', application_type: 'PCR', season_type: '', performance_category: '',
  position_category: '', shoulder_type: '', terrain_type: '', default_country_of_origin: '',
  warranty_km: '', seo_title: '', seo_description: '', tyre_overview: '', features: '',
  warranty_information: '', is_active: true, show_on_website: false, on_sale: false, discountable: true,
  category_ids: [],
}

type BrandOption = { brand_id: string; brand_name: string }
type CategoryOption = { category_id: string; category_name: string; category_type: string }
type AttributeRow = { id: string; attribute_type: string; attribute_value: string }

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:      'create' | 'edit'
  patternId?: string
  brandId?:   string
  brands:    BrandOption[]
  initial:   PatternFormState
  onSaved:   (result: { patternId: string; brandId: string }) => void
  onRequestDelete: () => void
}

export function PatternFormPanel({ mode, patternId, brandId: initialBrandId, brands, initial, onSaved, onRequestDelete }: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]                       = useState<PatternFormState>(initial)
  const [selectedBrandId, setSelectedBrandId] = useState(initialBrandId ?? '')
  const [saving, setSaving]                   = useState(false)
  const [uploading, setUploading]             = useState<'main' | 'tread' | null>(null)
  const [categories, setCategoriesList]       = useState<CategoryOption[]>([])
  const [catLoading, setCatLoading]           = useState(true)
  const [attributes, setAttributes]           = useState<AttributeRow[]>([])
  const mainImgRef  = useRef<HTMLInputElement>(null)
  const treadImgRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const tok = await getToken()
        const [catRes, attrRes] = await Promise.all([
          fetch(`${API}/api/admin/products/categories`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${API}/api/admin/products/attributes`, { headers: { Authorization: `Bearer ${tok}` } }),
        ])
        if (catRes.ok) setCategoriesList(await catRes.json())
        if (attrRes.ok) setAttributes(await attrRes.json())
      } catch { /* non-critical */ } finally { setCatLoading(false) }
    }
    loadData()
  }, [])

  const getOptions = (type: string): ComboOption[] =>
    attributes.filter(a => a.attribute_type === type).map(a => ({ value: a.attribute_value, label: a.attribute_value }))

  async function handleCreateAttr(type: string, value: string): Promise<ComboOption> {
    const tok = await getToken()
    const res = await fetch(`${API}/api/admin/products/attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ attribute_type: type, attribute_value: value }),
    })
    if (!res.ok) throw new Error('Failed to create attribute')
    const created = await res.json()
    setAttributes(prev => [...prev, created])
    return { value: created.attribute_value, label: created.attribute_value }
  }

  async function handleEditAttr(oldVal: string, newVal: string, type: string): Promise<ComboOption> {
    const attr = attributes.find(a => a.attribute_type === type && a.attribute_value === oldVal)
    if (!attr) throw new Error('Not found')
    const tok = await getToken()
    const res = await fetch(`${API}/api/admin/products/attributes/${attr.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ attribute_value: newVal }),
    })
    if (!res.ok) throw new Error('Failed to update attribute')
    setAttributes(prev => prev.map(a => a.id === attr.id ? { ...a, attribute_value: newVal } : a))
    return { value: newVal, label: newVal }
  }

  async function handleDeleteAttr(val: string, type: string): Promise<void> {
    const attr = attributes.find(a => a.attribute_type === type && a.attribute_value === val)
    if (!attr) throw new Error('Not found')
    const tok = await getToken()
    const res = await fetch(`${API}/api/admin/products/attributes/${attr.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (!res.ok) throw new Error('Failed to delete attribute')
    setAttributes(prev => prev.filter(a => a.id !== attr.id))
  }

  function set<K extends keyof PatternFormState>(key: K, val: PatternFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function uploadImage(file: File, field: 'main_image' | 'tread_image') {
    setUploading(field === 'main_image' ? 'main' : 'tread')
    try {
      const url = await uploadProductImage(file, 'patterns')
      set(field, url)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploading(null) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const brandId = selectedBrandId
    if (!brandId)                       { toastError('Please select a brand'); return }
    if (!form.pattern_name.trim())      { toastError('Pattern name is required'); return }
    if (!form.pattern_slug.trim())      { toastError('Slug is required'); return }
    if (form.category_ids.length === 0) { toastError('Please select a category'); return }

    setSaving(true)
    const tok = await getToken()
    const url = isEdit
      ? `${API}/api/admin/products/brands/${brandId}/patterns/${patternId}`
      : `${API}/api/admin/products/brands/${brandId}/patterns`

    const body = {
      pattern_name:              form.pattern_name.trim(),
      pattern_slug:              form.pattern_slug.trim(),
      pattern_short_description: form.pattern_short_description || null,
      pattern_description:       form.pattern_description       || null,
      main_image:                form.main_image                || null,
      tread_image:               form.tread_image               || null,
      application_type:          form.application_type,
      season_type:               form.season_type               || null,
      performance_category:      form.performance_category      || null,
      position_category:         form.position_category         || null,
      shoulder_type:             form.shoulder_type             || null,
      terrain_type:              form.terrain_type              || null,
      default_country_of_origin: form.default_country_of_origin || null,
      warranty_km:               form.warranty_km ? Number(form.warranty_km) : null,
      seo_title:                 form.seo_title                 || null,
      seo_description:           form.seo_description           || null,
      tyre_overview:             form.tyre_overview             || null,
      features:                  form.features                  || null,
      warranty_information:      form.warranty_information       || null,
      is_active:                 form.is_active,
      show_on_website:           form.show_on_website,
      on_sale:                   form.on_sale,
      discountable:              form.discountable,
      category_ids:              form.category_ids,
    }

    let saved: { pattern_id?: string } | undefined
    const req = fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    }).then(async res => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Failed to save pattern')
      }
      const json = await res.json() as { pattern_id?: string }
      saved = json
      return json
    })

    try {
      // toastPromise's return value is the toast handle, not the resolved data —
      // capture the real result via the `saved` closure above instead.
      await toastPromise(req, {
        loading: isEdit ? 'Saving pattern…'  : 'Creating pattern…',
        success: isEdit ? 'Pattern updated'  : 'Pattern created',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to save pattern',
      })
      const resolvedId = isEdit ? patternId! : saved?.pattern_id
      if (resolvedId) onSaved({ patternId: resolvedId, brandId })
    } catch { /* toasted */ } finally { setSaving(false) }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'
  const sectionHead = 'text-xs font-bold text-zinc-500 uppercase tracking-wide cursor-pointer select-none py-1'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">{isEdit ? 'Edit Pattern' : 'Create Pattern'}</h2>
          {isEdit && form.pattern_slug && <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{form.pattern_slug}</p>}
        </div>
        {isEdit && (
          <button type="button" onClick={onRequestDelete}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
            title="Delete pattern">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          {/* Identity */}
          <div>
            <label className={lbl}>Name <Req /></label>
            <input type="text" required value={form.pattern_name}
              onChange={e => { set('pattern_name', e.target.value); if (!isEdit) set('pattern_slug', slugify(e.target.value)) }}
              placeholder="e.g. COLO H/T" className={inp} />
          </div>
          <div>
            <label className={lbl}>Slug <Req /></label>
            <input value={form.pattern_slug} onChange={e => set('pattern_slug', e.target.value)}
              placeholder="colo-h-t" required className={`${inp} font-mono`} />
          </div>
          <div>
            <label className={lbl}>Brand <Req /></label>
            <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)} className={inp} required disabled={isEdit}>
              <option value="">— Choose Brand —</option>
              {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Category <Req /></label>
              {catLoading ? (
                <div className="h-[38px] rounded-lg bg-zinc-100 animate-pulse w-full" />
              ) : (
                <Select value={form.category_ids[0] || ''} onValueChange={val => setForm(prev => ({ ...prev, category_ids: val ? [val] : [] }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.category_id} value={c.category_id}>{c.category_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className={lbl}>Application</label>
              <select value={form.application_type} onChange={e => set('application_type', e.target.value)} className={inp}>
                <option value="PCR">Passenger (PCR)</option>
                <option value="4x4">4x4 / SUV</option>
                <option value="TBR">Truck &amp; Bus (TBR)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Season</label>
              <CreatableCombobox value={form.season_type} onChange={v => set('season_type', v)}
                options={getOptions('season')} onCreate={v => handleCreateAttr('season', v)}
                onEdit={(o, n) => handleEditAttr(o, n, 'season')} onDelete={v => handleDeleteAttr(v, 'season')} />
            </div>
            <div>
              <label className={lbl}>Terrain</label>
              <CreatableCombobox value={form.terrain_type} onChange={v => set('terrain_type', v)}
                options={getOptions('terrain')} onCreate={v => handleCreateAttr('terrain', v)}
                onEdit={(o, n) => handleEditAttr(o, n, 'terrain')} onDelete={v => handleDeleteAttr(v, 'terrain')} />
            </div>
          </div>

          <div>
            <label className={lbl}>TBR Position</label>
            <select value={form.position_category} onChange={e => set('position_category', e.target.value)} className={inp}>
              <option value="">N/A</option>
              <option value="steer">Steer</option>
              <option value="drive">Drive</option>
              <option value="trailer">Trailer</option>
              <option value="all_position">All Position</option>
            </select>
          </div>

          {/* Media */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Media Assets</p>
            <ImageField label="Main Image URL" value={form.main_image} uploading={uploading === 'main'}
              onChange={v => set('main_image', v)} onUploadClick={() => mainImgRef.current?.click()} inputClass={inp} />
            <input ref={mainImgRef} type="file" accept="image/*" className="sr-only"
              onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadImage(f, 'main_image'); e.target.value = '' }} />

            <ImageField label="Tread Image URL" value={form.tread_image} uploading={uploading === 'tread'}
              onChange={v => set('tread_image', v)} onUploadClick={() => treadImgRef.current?.click()} inputClass={inp} />
            <input ref={treadImgRef} type="file" accept="image/*" className="sr-only"
              onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadImage(f, 'tread_image'); e.target.value = '' }} />
          </div>

          {/* Flags */}
          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <FlagCheckbox id="is_active"       label="Active"             checked={form.is_active}       onChange={v => set('is_active', v)} />
            <FlagCheckbox id="show_on_website" label="Show on Website"    checked={form.show_on_website} onChange={v => set('show_on_website', v)} />
            <FlagCheckbox id="on_sale"         label="On Sale"            checked={form.on_sale}         onChange={v => set('on_sale', v)} />
            <FlagCheckbox id="discountable"    label="Discountable"       checked={form.discountable}    onChange={v => set('discountable', v)} />
          </div>

          {/* Collapsible sections — condensed for the narrower panel, but every field remains fully editable */}
          <details className="pt-3 border-t border-zinc-100">
            <summary className={sectionHead}>Description &amp; Copy</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={lbl}>Short Description</label>
                <Textarea value={form.pattern_short_description} onChange={e => set('pattern_short_description', e.target.value)} rows={2} className="resize-none" />
              </div>
              <div>
                <label className={lbl}>Full Description</label>
                <Textarea value={form.pattern_description} onChange={e => set('pattern_description', e.target.value)} rows={3} className="resize-none" />
              </div>
              <div>
                <label className={lbl}>Tyre Overview</label>
                <Textarea value={form.tyre_overview} onChange={e => set('tyre_overview', e.target.value)} rows={2} className="resize-none" />
              </div>
              <div>
                <label className={lbl}>Key Features</label>
                <Textarea value={form.features} onChange={e => set('features', e.target.value)} rows={2} className="resize-none" />
              </div>
            </div>
          </details>

          <details className="pt-3 border-t border-zinc-100">
            <summary className={sectionHead}>Specifications</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={lbl}>Performance</label>
                <CreatableCombobox value={form.performance_category} onChange={v => set('performance_category', v)}
                  options={getOptions('performance')} onCreate={v => handleCreateAttr('performance', v)}
                  onEdit={(o, n) => handleEditAttr(o, n, 'performance')} onDelete={v => handleDeleteAttr(v, 'performance')} />
              </div>
              <div>
                <label className={lbl}>Shoulder</label>
                <CreatableCombobox value={form.shoulder_type} onChange={v => set('shoulder_type', v)}
                  options={getOptions('shoulder')} onCreate={v => handleCreateAttr('shoulder', v)}
                  onEdit={(o, n) => handleEditAttr(o, n, 'shoulder')} onDelete={v => handleDeleteAttr(v, 'shoulder')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Country of Origin</label>
                  <input type="text" value={form.default_country_of_origin} onChange={e => set('default_country_of_origin', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Warranty (km)</label>
                  <input type="number" min={0} value={form.warranty_km} onChange={e => set('warranty_km', e.target.value)} className={inp} />
                </div>
              </div>
            </div>
          </details>

          <details className="pt-3 border-t border-zinc-100">
            <summary className={sectionHead}>Warranty Terms</summary>
            <div className="mt-3">
              <Textarea value={form.warranty_information} onChange={e => set('warranty_information', e.target.value)} rows={2} className="resize-none" />
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
              : isEdit ? 'Save Changes' : 'Save Pattern'
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
