'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toastPromise, toastError } from '@/lib/toast'
import { Trash2, ExternalLink, Upload } from 'lucide-react'
import type { Supplier } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const SUPPLIER_TYPES = [
  { value: 'wholesaler',          label: 'Wholesaler' },
  { value: 'factory',             label: 'Factory' },
  { value: 'marketplace_partner', label: 'Marketplace Partner' },
  { value: '3pl',                 label: '3PL' },
]

const ACCESS_TYPES = [
  { value: 'owned_after_purchase', label: 'Owned After Purchase' },
  { value: 'consignment',          label: 'Consignment' },
  { value: 'live_supplier_stock',  label: 'Live Supplier Stock' },
]

export type SupplierFormState = {
  supplier_name:     string
  supplier_type:     string
  contact_name:      string
  email:             string
  phone:             string
  state:             string
  country:           string
  payment_terms:     string
  stock_access_type: string
  api_connected:     boolean
  api_endpoint:      string
  api_key:           string
  api_auth_type:     string
  is_active:         boolean
}

export const EMPTY_SUPPLIER_FORM: SupplierFormState = {
  supplier_name: '', supplier_type: 'wholesaler', contact_name: '', email: '', phone: '',
  state: '', country: 'Australia', payment_terms: '', stock_access_type: 'owned_after_purchase',
  api_connected: false, api_endpoint: '', api_key: '', api_auth_type: 'api_key', is_active: true,
}

export function supplierToForm(s: Supplier): SupplierFormState {
  return {
    supplier_name:     s.supplier_name ?? '',
    supplier_type:     s.supplier_type ?? 'wholesaler',
    contact_name:      s.contact_name ?? '',
    email:             s.contact_email ?? '',
    phone:             s.contact_phone ?? '',
    state:             s.state ?? '',
    country:           s.country ?? 'Australia',
    payment_terms:     s.payment_terms ?? '',
    stock_access_type: s.stock_access_type ?? 'owned_after_purchase',
    api_connected:     s.api_connected ?? false,
    api_endpoint:      s.api_endpoint ?? '',
    api_key:           s.api_key ?? '',
    api_auth_type:     s.api_auth_type ?? 'api_key',
    is_active:         s.is_active ?? true,
  }
}

/** Inverse of `supplierToForm` — maps the submitted form back onto Supplier's field names, so a
 *  save can be spliced straight into the list instantly instead of waiting on a second network
 *  round-trip just to re-learn values we already have. */
export function formToSupplierPatch(form: SupplierFormState): Partial<Supplier> {
  return {
    supplier_name:     form.supplier_name,
    supplier_type:     form.supplier_type as Supplier['supplier_type'],
    contact_name:      form.contact_name || null,
    contact_email:     form.email || null,
    contact_phone:     form.phone || null,
    state:             form.state || null,
    country:           form.country || null,
    payment_terms:     form.payment_terms || null,
    stock_access_type: form.stock_access_type as Supplier['stock_access_type'],
    api_connected:     form.api_connected,
    api_endpoint:      form.api_connected ? (form.api_endpoint || null) : null,
    api_key:           form.api_connected ? (form.api_key || null) : null,
    api_auth_type:     form.api_connected ? (form.api_auth_type as Supplier['api_auth_type']) : null,
    is_active:         form.is_active,
  }
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-primary' : 'bg-zinc-300'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
      <span className="text-sm text-zinc-700">{label}</span>
    </label>
  )
}

interface Props {
  mode:        'create' | 'edit'
  supplierId?: string
  initial:     SupplierFormState
  // Passes back the full submitted form alongside the id, so the caller can splice the known-good
  // values straight into the list instantly instead of waiting on a second network round-trip.
  onSaved:     (result: { supplierId: string; form: SupplierFormState }) => void
  onRequestDelete: () => void
  onUploadCsv?: () => void
}

export function SupplierFormPanel({ mode, supplierId, initial, onSaved, onRequestDelete, onUploadCsv }: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]     = useState<SupplierFormState>(initial)
  const [saving, setSaving] = useState(false)

  // Re-sync when a fresh record is loaded into this same panel instance — e.g. right after saving
  // an edit, the panel doesn't remount (its `key` is unchanged since the selected id didn't change),
  // so without this the form would keep showing pre-save values instead of the canonical saved data.
  useEffect(() => { setForm(initial) }, [initial])

  function set<K extends keyof SupplierFormState>(key: K, val: SupplierFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!form.supplier_name.trim()) { toastError('Supplier name is required'); return }
    if (form.api_connected && !form.api_endpoint.trim()) { toastError('API endpoint URL is required'); return }
    if (form.api_connected && !form.api_key.trim()) { toastError('API key / token is required'); return }

    setSaving(true)
    const tok = await getToken()

    const body = {
      supplier_name:     form.supplier_name.trim(),
      supplier_type:     form.supplier_type     || null,
      contact_name:      form.contact_name      || null,
      // Backend column names are contact_email/contact_phone (matches supplierToForm's read side
      // and the Supplier type) — sending "email"/"phone" here silently drops both on every save.
      contact_email:     form.email             || null,
      contact_phone:     form.phone             || null,
      state:             form.state             || null,
      country:           form.country           || null,
      payment_terms:     form.payment_terms     || null,
      stock_access_type: form.stock_access_type || null,
      api_connected:     form.api_connected,
      api_endpoint:      form.api_connected ? (form.api_endpoint || null) : null,
      api_key:           form.api_connected ? (form.api_key      || null) : null,
      api_auth_type:     form.api_connected ? (form.api_auth_type || null) : null,
      is_active:         form.is_active,
    }

    let saved: Supplier | undefined
    const req = fetch(
      isEdit ? `${API}/api/admin/suppliers/${supplierId}` : `${API}/api/admin/suppliers`,
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(body),
      }
    ).then(async res => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Failed to save supplier')
      }
      const json = await res.json() as Supplier
      saved = json
      return json
    })

    try {
      await toastPromise(req, {
        loading: isEdit ? 'Saving supplier…'  : 'Creating supplier…',
        success: isEdit ? 'Supplier updated'  : 'Supplier created',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to save supplier',
      })
      const resolvedId = isEdit ? supplierId! : saved?.supplier_id
      if (resolvedId) onSaved({ supplierId: resolvedId, form: { ...form, supplier_name: body.supplier_name } })
    } catch { /* toasted */ } finally { setSaving(false) }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'
  const sectionHead = 'text-xs font-bold text-zinc-500 uppercase tracking-wide cursor-pointer select-none py-1'
  const authLabel = form.api_auth_type === 'bearer' ? 'Bearer Token' : form.api_auth_type === 'basic' ? 'Password / Secret' : 'API Key'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">{isEdit ? 'Edit Supplier' : 'Add Supplier'}</h2>
        </div>
        {isEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/admin/suppliers/${supplierId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
              title="Manage stock, mappings, CSV imports"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Manage
            </Link>
            {onUploadCsv && (
              <button type="button" onClick={onUploadCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
                title="Upload a stock CSV from this supplier">
                <Upload className="w-3.5 h-3.5" /> CSV
              </button>
            )}
            <button type="button" onClick={onRequestDelete} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 transition-colors"
              title="Delete supplier">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          <div>
            <label className={lbl}>Supplier Name <Req /></label>
            <input type="text" required value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} placeholder="Acme Tyres Pty Ltd" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Supplier Type</label>
              <select value={form.supplier_type} onChange={e => set('supplier_type', e.target.value)} className={inp}>
                {SUPPLIER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Stock Access</label>
              <select value={form.stock_access_type} onChange={e => set('stock_access_type', e.target.value)} className={inp}>
                {ACCESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <p className={sectionHead}>Contact Details</p>
            <div>
              <label className={lbl}>Contact Name</label>
              <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="orders@acme.com" className={inp} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+61 7 1234 5678" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>State</label>
                <input type="text" value={form.state} onChange={e => set('state', e.target.value)} placeholder="QLD" className={inp} />
              </div>
              <div>
                <label className={lbl}>Country</label>
                <input type="text" value={form.country} onChange={e => set('country', e.target.value)} placeholder="Australia" className={inp} />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100">
            <label className={lbl}>Payment Terms</label>
            <input type="text" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="COD, 30 days, 60 days…" className={inp} />
          </div>

          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <FlagCheckbox id="is_active" label="Active" checked={form.is_active} onChange={v => set('is_active', v)} />
          </div>

          <details className="pt-3 border-t border-zinc-100" open={form.api_connected}>
            <summary className={sectionHead}>API Integration</summary>
            <div className="mt-3 space-y-3">
              <Toggle checked={form.api_connected} onChange={v => set('api_connected', v)} label="Enable live API stock feed" />
              {form.api_connected && (
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div>
                    <label className={lbl}>Endpoint URL <Req /></label>
                    <input type="text" value={form.api_endpoint} onChange={e => set('api_endpoint', e.target.value)}
                      placeholder="https://api.supplier.com/v1/stock" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Auth Type</label>
                    <select value={form.api_auth_type} onChange={e => set('api_auth_type', e.target.value)} className={inp}>
                      <option value="api_key">API Key</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>{authLabel} <Req /></label>
                    <input type="password" autoComplete="off" value={form.api_key} onChange={e => set('api_key', e.target.value)}
                      placeholder={form.api_auth_type === 'bearer' ? 'eyJ...' : form.api_auth_type === 'basic' ? 'password' : 'sk-...'} className={inp} />
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
            {saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
              : isEdit ? 'Save Changes' : 'Save Supplier'
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
