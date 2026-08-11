'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toastSuccess, toastError } from '@/lib/toast'
import { Trash2, X } from 'lucide-react'
import type { AdminShippingMethod, ShippingMethodType } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const METHOD_TYPES: { value: ShippingMethodType; label: string }[] = [
  { value: 'own_fleet',       label: 'Own Fleet' },
  { value: 'courier_api',     label: 'Courier API' },
  { value: '3pl',             label: '3PL' },
  { value: 'supplier_direct', label: 'Supplier Direct' },
  { value: 'pickup',          label: 'Pickup' },
]

export type ShippingMethodFormState = {
  method_name:  string
  method_type:  ShippingMethodType
  api_provider: string
  is_active:    boolean
}

export const EMPTY_SHIPPING_METHOD_FORM: ShippingMethodFormState = {
  method_name:  '',
  method_type:  'own_fleet',
  api_provider: '',
  is_active:    true,
}

export function shippingMethodToForm(m: AdminShippingMethod): ShippingMethodFormState {
  return {
    method_name:  m.method_name ?? '',
    method_type:  m.method_type ?? 'own_fleet',
    api_provider: m.api_provider ?? '',
    is_active:    m.is_active ?? true,
  }
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:             'create' | 'edit'
  methodId?:        string
  initial:          ShippingMethodFormState
  onSaved:          () => void
  onRequestDelete?: () => void
  onClose?:         () => void
}

export function ShippingMethodFormPanel({
  mode,
  methodId,
  initial,
  onSaved,
  onRequestDelete,
  onClose,
}: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]     = useState<ShippingMethodFormState>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(initial)
  }, [initial])

  function set<K extends keyof ShippingMethodFormState>(key: K, value: ShippingMethodFormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.method_name.trim()) {
      toastError('Method name is required')
      return
    }

    setSaving(true)
    try {
      const tok = await getToken()
      const payload = {
        method_name:  form.method_name.trim(),
        method_type:  form.method_type,
        api_provider: form.api_provider.trim() || null,
        is_active:    form.is_active,
      }

      const url = isEdit ? `${API}/api/admin/shipping/methods/${methodId}` : `${API}/api/admin/shipping/methods`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Save failed')
      }

      toastSuccess(isEdit ? 'Shipping method updated' : 'Shipping method created')
      onSaved()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-md overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-900">
            {isEdit ? 'Edit Shipping Method' : 'Create Shipping Method'}
          </h2>
          {isEdit && form.method_name && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{form.method_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEdit && onRequestDelete && (
            <button
              type="button"
              onClick={onRequestDelete}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              title="Delete shipping method"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
          <div>
            <label className={lbl}>Method Name <Req /></label>
            <input
              type="text"
              required
              value={form.method_name}
              onChange={e => set('method_name', e.target.value)}
              placeholder="e.g. StarTrack Express, Fleet Delivery"
              className={inp}
            />
          </div>

          <div>
            <label className={lbl}>Type <Req /></label>
            <select
              value={form.method_type}
              onChange={e => set('method_type', e.target.value as ShippingMethodType)}
              className={inp}
            >
              {METHOD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>API / Provider Name</label>
            <input
              type="text"
              value={form.api_provider}
              onChange={e => set('api_provider', e.target.value)}
              placeholder="e.g. StarTrack API, Sendle"
              className={inp}
            />
            <p className="text-[11px] text-zinc-400 mt-1">Leave blank if handled manually or without external API</p>
          </div>

          <div className="pt-2 border-t border-zinc-100">
            <label className="flex items-center gap-2.5 text-sm text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/30 focus:ring-2"
              />
              Active (available for quoting & shipments)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />
                {isEdit ? 'Saving Changes…' : 'Creating Method…'}
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Create Shipping Method'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function Req() {
  return <span className="text-red-500 ml-0.5">*</span>
}
