'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toastPromise, toastError } from '@/lib/toast'
import { Trash2, ExternalLink } from 'lucide-react'
import type { CustomerListItem } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type CustomerFormState = {
  email:     string
  firstName: string
  lastName:  string
  phone:     string
}

export const EMPTY_CUSTOMER_FORM: CustomerFormState = {
  email: '', firstName: '', lastName: '', phone: '',
}

export function customerToForm(c: CustomerListItem): CustomerFormState {
  return {
    email:     c.email ?? '',
    firstName: c.first_name ?? '',
    lastName:  c.last_name ?? '',
    phone:     c.phone ?? '',
  }
}

/** Inverse of `customerToForm` — maps the submitted form back onto CustomerListItem's field names,
 *  so a save can be spliced straight into the list instantly instead of waiting on a second
 *  network round-trip just to re-learn values we already have. */
export function formToCustomerPatch(form: CustomerFormState): Partial<CustomerListItem> {
  return {
    email:      form.email,
    first_name: form.firstName || null,
    last_name:  form.lastName || null,
    phone:      form.phone || null,
  }
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:        'create' | 'edit'
  customerId?: string
  initial:     CustomerFormState
  // Passes back the full submitted form alongside the id, so the caller can splice the known-good
  // values straight into the list instantly instead of waiting on a second network round-trip.
  onSaved:     (result: { customerId: string; form: CustomerFormState }) => void
  onRequestDelete: () => void
}

export function CustomerFormPanel({ mode, customerId, initial, onSaved, onRequestDelete }: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]     = useState<CustomerFormState>(initial)
  const [saving, setSaving] = useState(false)

  // Re-sync when a fresh record is loaded into this same panel instance — e.g. right after saving
  // an edit, the panel doesn't remount (its `key` is unchanged since the selected id didn't change),
  // so without this the form would keep showing pre-save values instead of the canonical saved data.
  useEffect(() => { setForm(initial) }, [initial])

  function set<K extends keyof CustomerFormState>(key: K, val: CustomerFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!form.email.trim()) { toastError('Email is required'); return }

    setSaving(true)
    const tok = await getToken()

    const body = {
      email:     form.email.trim(),
      firstName: form.firstName || null,
      lastName:  form.lastName  || null,
      phone:     form.phone     || null,
    }

    let saved: { customer_id?: string } | undefined
    const req = fetch(
      isEdit ? `${API}/api/admin/customers/${customerId}` : `${API}/api/admin/customers`,
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(body),
      }
    ).then(async res => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(b.error ?? 'Failed to save customer')
      }
      const json = await res.json() as { customer?: { customer_id: string } }
      saved = json.customer
      return json
    })

    try {
      await toastPromise(req, {
        loading: isEdit ? 'Saving customer…'  : 'Creating customer…',
        success: isEdit ? 'Customer updated'  : 'Customer created',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to save customer',
      })
      const resolvedId = isEdit ? customerId! : saved?.customer_id
      if (resolvedId) onSaved({ customerId: resolvedId, form: { ...form, email: body.email } })
    } catch { /* toasted */ } finally { setSaving(false) }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">{isEdit ? 'Edit Customer' : 'Create Customer'}</h2>
          {isEdit && form.email && <p className="text-xs text-zinc-500 mt-0.5 truncate">{form.email}</p>}
        </div>
        {isEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/admin/customers/${customerId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
              title="View orders, addresses, and full profile"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Profile
            </Link>
            <button type="button" onClick={onRequestDelete} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 transition-colors"
              title="Delete customer">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
          <div>
            <label className={lbl}>Email <Req /></label>
            <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@example.com" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>First Name</label>
              <input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Last Name</label>
              <input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={inp} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
            {saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
              : isEdit ? 'Save Changes' : 'Save Customer'
            }
          </button>
        </div>
      </form>
    </div>
  )
}

function Req() { return <span className="text-red-500 ml-0.5">*</span> }
