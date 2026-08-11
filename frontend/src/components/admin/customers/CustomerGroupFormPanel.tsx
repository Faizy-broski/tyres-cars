'use client'

import { useEffect, useState } from 'react'
import { BACKEND_API_URL, createBackendHeaders, readBackendError } from '@/lib/backend-api'
import { Textarea } from '@/components/ui/textarea'
import { toastSuccess, toastError } from '@/lib/toast'
import { Trash2, X } from 'lucide-react'
import type { CustomerGroup } from '@/types/admin.types'

const DISCOUNT_TYPES = [
  { value: '',             label: '— None —' },
  { value: 'percent',      label: 'Percentage (%)' },
  { value: 'fixed_amount', label: 'Fixed Amount ($)' },
]

const PRICE_TYPES = [
  { value: '',          label: '— Default (Standard) —' },
  { value: 'retail',    label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'price_a',   label: 'Tier A' },
  { value: 'price_b',   label: 'Tier B' },
  { value: 'special',   label: 'Special' },
  { value: 'clearance', label: 'Clearance' },
]

export type CustomerGroupFormState = {
  name:               string
  description:        string
  default_discount:   string
  discount_type:      string
  discount_value:     string
  price_type:         string
  can_view_wholesale: boolean
  is_active:          boolean
}

export const EMPTY_CUSTOMER_GROUP_FORM: CustomerGroupFormState = {
  name:               '',
  description:        '',
  default_discount:   '',
  discount_type:      '',
  discount_value:     '',
  price_type:         '',
  can_view_wholesale: false,
  is_active:          true,
}

export function groupToForm(g: CustomerGroup): CustomerGroupFormState {
  return {
    name:               g.group_name ?? '',
    description:        g.description ?? '',
    default_discount:   g.default_discount != null ? String(g.default_discount) : '',
    discount_type:      g.discount_type ?? '',
    discount_value:     g.discount_value != null ? String(g.discount_value) : '',
    price_type:         g.price_type ?? '',
    can_view_wholesale: g.can_view_wholesale ?? false,
    is_active:          g.is_active ?? true,
  }
}

interface Props {
  mode:             'create' | 'edit'
  groupId?:         string
  initial:          CustomerGroupFormState
  accessToken:      string
  onSaved:          (saved: CustomerGroup) => void
  onRequestDelete?: () => void
  onClose?:         () => void
}

export function CustomerGroupFormPanel({
  mode,
  groupId,
  initial,
  accessToken,
  onSaved,
  onRequestDelete,
  onClose,
}: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]     = useState<CustomerGroupFormState>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(initial)
  }, [initial])

  function f<K extends keyof CustomerGroupFormState>(key: K, value: CustomerGroupFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toastError('Group name is required')
      return
    }

    setSaving(true)
    try {
      const url    = isEdit ? `${BACKEND_API_URL}/api/admin/customers/groups/${groupId}` : `${BACKEND_API_URL}/api/admin/customers/groups`
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: createBackendHeaders(accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name:               form.name.trim(),
          description:        form.description.trim() || null,
          default_discount:   form.default_discount ? Number(form.default_discount) : null,
          discount_type:      form.discount_type || null,
          discount_value:     form.discount_value ? Number(form.discount_value) : null,
          price_type:         form.price_type || null,
          can_view_wholesale: form.can_view_wholesale,
          is_active:          form.is_active,
        }),
      })

      if (!res.ok) {
        throw new Error(await readBackendError(res, `Failed to ${isEdit ? 'update' : 'create'} group`))
      }

      const saved: CustomerGroup = await res.json()
      toastSuccess(isEdit ? 'Group updated' : 'Group created')
      onSaved(saved)
    } catch (err: unknown) {
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
            {isEdit ? 'Edit Customer Group' : 'Create Customer Group'}
          </h2>
          {isEdit && form.name && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{form.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEdit && onRequestDelete && (
            <button
              type="button"
              onClick={onRequestDelete}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              title="Delete group"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
          <div>
            <label className={lbl}>Group Name <Req /></label>
            <input
              type="text"
              required
              placeholder="e.g. Wholesale, VIP, Trade"
              value={form.name}
              onChange={e => f('name', e.target.value)}
              className={inp}
            />
          </div>

          <div>
            <label className={lbl}>Description</label>
            <Textarea
              rows={2}
              placeholder="Describe this group's tier benefits or purpose..."
              value={form.description}
              onChange={e => f('description', e.target.value)}
              className="resize-none text-xs rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Price Tier</label>
              <select
                value={form.price_type}
                onChange={e => f('price_type', e.target.value)}
                className={inp}
              >
                {PRICE_TYPES.map(pt => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Default Discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
                value={form.default_discount}
                onChange={e => f('default_discount', e.target.value)}
                className={inp}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Specific Discount Type</label>
              <select
                value={form.discount_type}
                onChange={e => f('discount_type', e.target.value)}
                className={inp}
              >
                {DISCOUNT_TYPES.map(dt => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Discount Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={form.discount_type === 'percent' ? 'e.g. 10 (%)' : 'e.g. 25 ($)'}
                value={form.discount_value}
                onChange={e => f('discount_value', e.target.value)}
                disabled={!form.discount_type}
                className={`${inp} disabled:opacity-50`}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.can_view_wholesale}
                onChange={e => f('can_view_wholesale', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/30 focus:ring-2"
              />
              Can view wholesale portal & pricing
            </label>

            <label className="flex items-center gap-2.5 text-sm text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => f('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/30 focus:ring-2"
              />
              Active group
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
                {isEdit ? 'Saving Changes…' : 'Creating Group…'}
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Create Customer Group'
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
