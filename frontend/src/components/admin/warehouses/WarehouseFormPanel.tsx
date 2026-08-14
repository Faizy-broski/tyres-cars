'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toastPromise, toastError } from '@/lib/toast'
import { Trash2 } from 'lucide-react'
import type { Warehouse, WarehouseType } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const

export type WarehouseFormState = {
  warehouse_name:         string
  warehouse_type:         WarehouseType
  state:                  string
  suburb:                 string
  postcode:               string
  address:                string
  contact_name:           string
  contact_phone:          string
  contact_email:          string
  is_own_warehouse:       boolean
  is_supplier_warehouse:  boolean
  is_active:              boolean
}

export const EMPTY_WAREHOUSE_FORM: WarehouseFormState = {
  warehouse_name: '', warehouse_type: 'own', state: '', suburb: '', postcode: '',
  address: '', contact_name: '', contact_phone: '', contact_email: '',
  is_own_warehouse: true, is_supplier_warehouse: false, is_active: true,
}

export function warehouseToForm(w: Warehouse): WarehouseFormState {
  return {
    warehouse_name:         w.warehouse_name ?? '',
    warehouse_type:         w.warehouse_type ?? 'own',
    state:                   w.state ?? '',
    suburb:                  w.suburb ?? '',
    postcode:                w.postcode ?? '',
    address:                 w.address ?? '',
    contact_name:            w.contact_name ?? '',
    contact_phone:           w.contact_phone ?? '',
    contact_email:           w.contact_email ?? '',
    is_own_warehouse:        w.is_own_warehouse ?? false,
    is_supplier_warehouse:   w.is_supplier_warehouse ?? false,
    is_active:               w.is_active ?? true,
  }
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:         'create' | 'edit'
  warehouseId?: string
  initial:      WarehouseFormState
  // Passes back the full submitted form alongside the id, so the caller can splice the known-good
  // values straight into the list instantly instead of waiting on a second network round-trip.
  onSaved:      (result: { warehouseId: string; form: WarehouseFormState }) => void
  onRequestDelete: () => void
}

export function WarehouseFormPanel({ mode, warehouseId, initial, onSaved, onRequestDelete }: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]     = useState<WarehouseFormState>(initial)
  const [saving, setSaving] = useState(false)

  // Re-sync when a fresh record is loaded into this same panel instance — e.g. right after saving
  // an edit, the panel doesn't remount (its `key` is unchanged since the selected id didn't change),
  // so without this the form would keep showing pre-save values instead of the canonical saved data.
  useEffect(() => { setForm(initial) }, [initial])

  function set<K extends keyof WarehouseFormState>(key: K, val: WarehouseFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!form.warehouse_name.trim()) { toastError('Warehouse name is required'); return }
    if (!form.state)                 { toastError('State is required'); return }

    setSaving(true)
    const tok = await getToken()

    const body = {
      warehouse_name:        form.warehouse_name.trim(),
      warehouse_type:        form.warehouse_type,
      state:                 form.state,
      suburb:                form.suburb        || null,
      postcode:              form.postcode      || null,
      address:               form.address       || null,
      contact_name:          form.contact_name  || null,
      contact_phone:         form.contact_phone || null,
      contact_email:         form.contact_email || null,
      is_own_warehouse:      form.is_own_warehouse,
      is_supplier_warehouse: form.is_supplier_warehouse,
      is_active:             form.is_active,
    }

    let saved: Warehouse | undefined
    const req = fetch(
      isEdit ? `${API}/api/admin/orders/warehouses/${warehouseId}` : `${API}/api/admin/orders/warehouses`,
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(body),
      }
    ).then(async res => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Failed to save warehouse')
      }
      const json = await res.json() as Warehouse
      saved = json
      return json
    })

    try {
      await toastPromise(req, {
        loading: isEdit ? 'Saving warehouse…'  : 'Creating warehouse…',
        success: isEdit ? 'Warehouse updated'  : 'Warehouse created',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to save warehouse',
      })
      const resolvedId = isEdit ? warehouseId! : saved?.warehouse_id
      if (resolvedId) onSaved({ warehouseId: resolvedId, form: { ...form, warehouse_name: body.warehouse_name } })
    } catch { /* toasted */ } finally { setSaving(false) }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'
  const sectionHead = 'text-xs font-bold text-zinc-500 uppercase tracking-wide cursor-pointer select-none py-1'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">{isEdit ? 'Edit Warehouse' : 'Create Warehouse'}</h2>
          {isEdit && form.warehouse_name && <p className="text-xs text-zinc-500 mt-0.5 truncate">{form.warehouse_name}</p>}
        </div>
        {isEdit && (
          <button type="button" onClick={onRequestDelete} disabled={saving}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 transition-colors"
            title="Delete warehouse">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          <div>
            <label className={lbl}>Warehouse Name <Req /></label>
            <input type="text" required value={form.warehouse_name}
              onChange={e => set('warehouse_name', e.target.value)}
              placeholder="e.g. Sydney Main" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Type <Req /></label>
              <select value={form.warehouse_type} onChange={e => set('warehouse_type', e.target.value as WarehouseType)} className={inp}>
                <option value="own">Own</option>
                <option value="supplier">Supplier</option>
                <option value="3pl">3PL</option>
              </select>
            </div>
            <div>
              <label className={lbl}>State <Req /></label>
              <select value={form.state} onChange={e => set('state', e.target.value)} className={inp} required>
                <option value="">— Select —</option>
                {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Location</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Suburb</label>
                <input value={form.suburb} onChange={e => set('suburb', e.target.value)} placeholder="e.g. Wetherill Park" className={inp} />
              </div>
              <div>
                <label className={lbl}>Postcode</label>
                <input value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="2164" maxLength={10} className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Full Address</label>
              <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2}
                placeholder="Street address…" className={`${inp} resize-none`} />
            </div>
          </div>

          {/* Contact */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Contact Name</label>
                <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" className={inp} />
              </div>
              <div>
                <label className={lbl}>Contact Phone</label>
                <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="02 9xxx xxxx" className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Contact Email</label>
              <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="warehouse@example.com" className={inp} />
            </div>
          </div>

          {/* Flags */}
          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <FlagCheckbox id="is_active"              label="Active (available for stock routing)" checked={form.is_active}              onChange={v => set('is_active', v)} />
            <FlagCheckbox id="is_own_warehouse"        label="Own Warehouse"                          checked={form.is_own_warehouse}       onChange={v => set('is_own_warehouse', v)} />
            <FlagCheckbox id="is_supplier_warehouse"   label="Supplier Warehouse"                      checked={form.is_supplier_warehouse}  onChange={v => set('is_supplier_warehouse', v)} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
            {saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
              : isEdit ? 'Save Changes' : 'Save Warehouse'
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
