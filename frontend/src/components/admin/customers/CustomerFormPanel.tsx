'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toastPromise, toastError } from '@/lib/toast'
import { Trash2, ExternalLink } from 'lucide-react'
import type { CustomerListItem, CustomerType, AccountStatus } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type CustomerFormState = {
  email:            string
  firstName:        string
  lastName:         string
  company:          string
  phone:            string
  customerType:     CustomerType
  accountStatus:    AccountStatus
  customerGroupId:  string
  creditLimit:      string
  paymentTerms:     string
}

export const EMPTY_CUSTOMER_FORM: CustomerFormState = {
  email: '', firstName: '', lastName: '', company: '', phone: '',
  customerType: 'retail', accountStatus: 'active', customerGroupId: '',
  creditLimit: '', paymentTerms: '',
}

export function customerToForm(c: CustomerListItem): CustomerFormState {
  return {
    email:           c.email ?? '',
    firstName:       c.first_name ?? '',
    lastName:        c.last_name ?? '',
    company:         c.business_name ?? '',
    phone:           c.phone ?? '',
    customerType:    c.customer_type ?? 'retail',
    accountStatus:   c.account_status ?? 'active',
    customerGroupId: c.customer_group_id ?? '',
    creditLimit:     c.credit_limit != null ? String(c.credit_limit) : '',
    paymentTerms:    c.payment_terms ?? '',
  }
}

type GroupOption = { group_id: string; group_name: string }

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:        'create' | 'edit'
  customerId?: string
  initial:     CustomerFormState
  onSaved:     (result: { customerId: string }) => void
  onRequestDelete: () => void
}

export function CustomerFormPanel({ mode, customerId, initial, onSaved, onRequestDelete }: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]     = useState<CustomerFormState>(initial)
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getToken().then(tok => {
      fetch(`${API}/api/admin/customers/groups/list?page=1`, { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(d => { if (!cancelled) setGroups(d.groups ?? []) })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [])

  function set<K extends keyof CustomerFormState>(key: K, val: CustomerFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const showCreditFields = ['wholesale', 'fleet', 'trade'].includes(form.customerType)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim()) { toastError('Email is required'); return }

    setSaving(true)
    const tok = await getToken()

    const body = {
      email:           form.email.trim(),
      firstName:       form.firstName       || null,
      lastName:        form.lastName        || null,
      company:         form.company         || null,
      phone:           form.phone           || null,
      customerType:    form.customerType    || 'retail',
      accountStatus:   form.accountStatus   || 'active',
      customerGroupId: form.customerGroupId || null,
      creditLimit:     form.creditLimit ? Number(form.creditLimit) : null,
      paymentTerms:    form.paymentTerms    || null,
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
      if (resolvedId) onSaved({ customerId: resolvedId })
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
            <button type="button" onClick={onRequestDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
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
            <label className={lbl}>Company</label>
            <input type="text" value={form.company} onChange={e => set('company', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={inp} />
          </div>

          <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Customer Type</label>
              <select value={form.customerType} onChange={e => set('customerType', e.target.value as CustomerType)} className={inp}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="fleet">Fleet</option>
                <option value="trade">Trade</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Account Status</label>
              <select value={form.accountStatus} onChange={e => set('accountStatus', e.target.value as AccountStatus)} className={inp}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Customer Group</label>
            <select value={form.customerGroupId} onChange={e => set('customerGroupId', e.target.value)} className={inp}>
              <option value="">— None —</option>
              {groups.map(g => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
            </select>
          </div>

          {showCreditFields && (
            <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Credit Limit</label>
                <input type="number" min={0} value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} placeholder="0.00" className={inp} />
              </div>
              <div>
                <label className={lbl}>Payment Terms</label>
                <input type="text" value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} placeholder="e.g. Net 30" className={inp} />
              </div>
            </div>
          )}
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
