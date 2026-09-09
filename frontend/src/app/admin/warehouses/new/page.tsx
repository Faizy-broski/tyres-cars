'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toastError, toastSuccess } from '@/lib/toast'
import type { WarehouseType } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const WAREHOUSE_TYPES: { value: WarehouseType; label: string }[] = [
  { value: 'own',      label: 'Own' },
  { value: 'supplier', label: 'Supplier' },
  { value: '3pl',      label: '3PL' },
]

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

type FormState = {
  warehouse_name:        string
  warehouse_type:        WarehouseType
  state:                 string
  suburb:                string
  postcode:              string
  address:               string
  contact_name:          string
  contact_phone:         string
  contact_email:         string
  is_own_warehouse:      boolean
  is_supplier_warehouse: boolean
  is_active:             boolean
}

const EMPTY: FormState = {
  warehouse_name:        '',
  warehouse_type:        'own',
  state:                 '',
  suburb:                '',
  postcode:              '',
  address:               '',
  contact_name:          '',
  contact_phone:         '',
  contact_email:         '',
  is_own_warehouse:      true,
  is_supplier_warehouse: false,
  is_active:             true,
}

const inp = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white'
const lbl = 'block text-sm font-medium text-zinc-700 mb-1'

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

export default function NewWarehousePage() {
  const router = useRouter()
  const [form, setForm]   = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { document.title = 'New Warehouse | Tyres & Car Valeting' }, [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.warehouse_name.trim()) return toastError('Warehouse name is required')
    if (!form.state)                 return toastError('State is required')

    setSaving(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const tok = session?.access_token ?? ''
      const payload = {
        warehouse_name:        form.warehouse_name.trim(),
        warehouse_type:        form.warehouse_type,
        state:                 form.state,
        suburb:                form.suburb   || null,
        postcode:              form.postcode || null,
        address:               form.address  || null,
        contact_name:          form.contact_name  || null,
        contact_phone:         form.contact_phone || null,
        contact_email:         form.contact_email || null,
        is_own_warehouse:      form.is_own_warehouse,
        is_supplier_warehouse: form.is_supplier_warehouse,
        is_active:             form.is_active,
      }
      const res = await fetch(`${API}/api/admin/orders/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Save failed')
      }
      toastSuccess('Warehouse created')
      router.push('/admin/warehouses')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <AdminBreadcrumb crumbs={[
        { label: 'Warehouses', href: '/admin/warehouses' },
        { label: 'New Warehouse' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-zinc-900">New Warehouse</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Add a warehouse, supplier, or 3PL location for stock routing</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Identity */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-700">Warehouse Details</h2>

          <div>
            <label className={lbl}>Warehouse Name <span className="text-red-500">*</span></label>
            <Input
              value={form.warehouse_name}
              onChange={e => set('warehouse_name', e.target.value)}
              placeholder="Brisbane Warehouse"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Warehouse Type <span className="text-red-500">*</span></label>
              <select value={form.warehouse_type} onChange={e => set('warehouse_type', e.target.value as WarehouseType)} className={inp} required>
                {WAREHOUSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>State <span className="text-red-500">*</span></label>
              <select value={form.state} onChange={e => set('state', e.target.value)} className={inp} required>
                <option value="">Select state…</option>
                {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Suburb</label>
              <Input value={form.suburb} onChange={e => set('suburb', e.target.value)} placeholder="Pinkenba" />
            </div>
            <div>
              <label className={lbl}>Postcode</label>
              <Input value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="4008" maxLength={10} />
            </div>
          </div>

          <div>
            <label className={lbl}>Full Address</label>
            <Textarea
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="123 Logistics Drive, Pinkenba QLD 4008"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">Operational Contact</h2>

          <div>
            <label className={lbl}>Name</label>
            <Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Phone</label>
              <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+61 7 1234 5678" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="warehouse@example.com" />
            </div>
          </div>
        </div>

        {/* Flags */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">Settings</h2>
          <Toggle checked={form.is_own_warehouse}      onChange={v => set('is_own_warehouse', v)}      label="Own warehouse (company-held stock)" />
          <Toggle checked={form.is_supplier_warehouse} onChange={v => set('is_supplier_warehouse', v)} label="Supplier warehouse (supplier stock location)" />
          <Toggle checked={form.is_active}             onChange={v => set('is_active', v)}             label="Active (available for stock & order routing)" />
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => router.push('/admin/warehouses')} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create Warehouse'}
          </Button>
        </div>
      </form>
    </div>
  )
}

