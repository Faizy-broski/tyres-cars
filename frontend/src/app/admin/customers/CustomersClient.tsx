'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { TableBodySpinner } from '@/components/ui/table-loader'
import { CustomerFormPanel, EMPTY_CUSTOMER_FORM, customerToForm, formToCustomerPatch, type CustomerFormState } from '@/components/admin/customers/CustomerFormPanel'
import { toastError, toastSuccess } from '@/lib/toast'
import { useQueryClient } from '@tanstack/react-query'
import {
  useCustomerList, useCustomerStats,
  type CustomerStats, type CustomerListResponse,
} from '@/lib/query/hooks'
import type { CustomerListItem } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function AccountBadge({ isGuest }: { isGuest: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium w-fit ${
      isGuest ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isGuest ? 'bg-amber-500' : 'bg-green-500'}`} />
      {isGuest ? 'Guest' : 'Registered'}
    </span>
  )
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtAUD(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function KpiCard({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub: string; icon: React.ReactNode }) {
  return (
    <div className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm text-zinc-500">{label}</p>
        <div className="p-2.5 rounded-xl bg-zinc-50 text-zinc-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-200">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-zinc-900 tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{sub}</p>
    </div>
  )
}

const LIMIT = 20

const EMPTY_STATS: CustomerStats = { totalCustomers: 0, totalOrders: 0, avgOrderSize: 0, totalRevenue: 0 }

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

type Props = {
  initialStats?:     CustomerStats
  initialCustomers?: CustomerListResponse
}

export default function CustomersClient({ initialStats, initialCustomers }: Props) {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const pathname      = usePathname()
  const queryClient   = useQueryClient()

  const search       = searchParams.get('search') ?? ''
  const page         = Number(searchParams.get('page') ?? 1)
  const accountType  = (searchParams.get('accountType') as 'guest' | 'registered' | undefined) ?? undefined

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<CustomerFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isDefaultView = page === 1 && !search && !accountType

  const statsQuery = useCustomerStats({ initialData: initialStats })
  const listQuery  = useCustomerList(
    { search, page, accountType, customerType: '', statusFilter: '' },
    { initialData: isDefaultView ? initialCustomers : undefined },
  )

  const loading   = listQuery.isPending || statsQuery.isPending
  const stats     = statsQuery.data     ?? EMPTY_STATS
  const customers = listQuery.data?.customers ?? []
  const count     = listQuery.data?.total     ?? 0

  const buildHref = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (accountType) p.set('accountType', accountType)
    if (page > 1) p.set('page', String(page))
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    return p.toString() ? `${pathname}?${p}` : pathname
  }, [search, accountType, page, pathname])

  const totalPages  = Math.max(1, Math.ceil(count / LIMIT))
  const startResult = count === 0 ? 0 : (page - 1) * LIMIT + 1
  const endResult   = count === 0 ? 0 : (page - 1) * LIMIT + customers.length

  function selectCustomer(c: CustomerListItem) {
    setSelectedId(c.customer_id)
    setSelectedForm(customerToForm(c))
  }

  function handleNewCustomer() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  async function handleSaved(saved: { customerId: string; form: CustomerFormState }) {
    const existing = customers.find(c => c.customer_id === saved.customerId)

    if (existing) {
      // Edit of an already-visible row: we already know exactly what changed — splice it into the
      // cached list immediately instead of waiting on a second round-trip (GET) just to re-learn it.
      const merged: CustomerListItem = { ...existing, ...formToCustomerPatch(saved.form) }
      queryClient.setQueriesData<CustomerListResponse>({ queryKey: ['admin', 'customers', 'list'] }, old => {
        if (!old?.customers) return old
        return { ...old, customers: old.customers.map(c => c.customer_id === saved.customerId ? merged : c) }
      })
      selectCustomer(merged)
      // Reconcile with server truth in the background — deliberately delayed, not fired immediately.
      // An immediate refetch can win the race against the write it's meant to confirm and land a
      // moment later with pre-save data, silently stomping the correct value we just painted.
      setTimeout(() => listQuery.refetch(), 1500)
    } else {
      // Newly created record — no existing row to splice into, so a real refetch is unavoidable.
      const { data: fresh } = await listQuery.refetch()
      const found = fresh?.customers.find(c => c.customer_id === saved.customerId)
      if (found) selectCustomer(found)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/customers/${deleteTarget.customer_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      toastSuccess('Customer deleted')
      setDeleteTarget(null)
      if (selectedId === deleteTarget.customer_id) { setSelectedId(null); setSelectedForm(null) }
      listQuery.refetch()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="space-y-5 px-4 sm:px-6 pt-4 sm:pt-6">
        <AdminBreadcrumb crumbs={[{ label: 'Customers' }]} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Customer" value={stats.totalCustomers} sub="Active customers"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>}
        />
        <KpiCard label="Total Orders" value={stats.totalOrders} sub="All orders"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KpiCard label="Average Order size" value={fmtAUD(stats.avgOrderSize)} sub={`From ${stats.totalOrders} orders`}
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
        />
        <KpiCard label="Total Revenue" value={fmtAUD(stats.totalRevenue)} sub="From all orders"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
        />
        </div>
      </div>

      <SplitView
        title="Customers"
        headerAction={
          <button
            type="button"
            onClick={handleNewCustomer}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
          >
            + Create Customer
          </button>
        }
        list={
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-3">
              <select
                value={accountType ?? ''}
                onChange={e => router.push(buildHref({ accountType: e.target.value, page: '1' }))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  accountType ? 'border-zinc-900 text-zinc-900 bg-zinc-50' : 'border-zinc-300 text-zinc-600'
                }`}
              >
                <option value="">All Accounts</option>
                <option value="guest">Guest</option>
                <option value="registered">Registered</option>
              </select>

              {(accountType || search) && (
                <button
                  type="button"
                  onClick={() => router.push(buildHref({ accountType: '', search: '', page: '1' }))}
                  className="text-xs text-zinc-400 hover:text-red-600 transition-colors"
                >
                  ✕ Clear
                </button>
              )}

              <form
                onSubmit={e => {
                  e.preventDefault()
                  const q = (new FormData(e.currentTarget).get('search') as string) ?? ''
                  router.push(buildHref({ search: q, page: '1' }))
                }}
                className="relative ml-auto"
              >
                <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  name="search" defaultValue={search} placeholder="Search customers…"
                  className="w-48 rounded-lg border border-zinc-300 py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orders</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Value</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <TableBodySpinner />
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <p className="text-sm font-medium text-zinc-400">{search ? `No customers matching "${search}"` : 'No customers yet.'}</p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer, idx) => {
                      const displayId = `CUST-${String((page - 1) * LIMIT + idx + 1).padStart(3, '0')}`
                      const isSelected = selectedId === customer.customer_id
                      return (
                        <tr key={customer.customer_id}
                          className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${isSelected ? '!bg-primary/10' : ''}`}
                          onClick={() => selectCustomer(customer)}
                        >
                          <td className="px-5 py-3 font-mono text-xs text-zinc-500">{displayId}</td>
                          <td className="px-5 py-3 text-xs text-zinc-600">{customer.email}</td>
                          <td className="px-5 py-3 text-sm font-medium text-zinc-900">
                            {[customer.first_name, customer.last_name].filter(Boolean).join(' ') || '—'}
                          </td>
                          <td className="px-5 py-3"><AccountBadge isGuest={!customer.profile_id} /></td>
                          <td className="px-5 py-3 text-right text-sm text-zinc-700">{customer.order_count ?? 0}</td>
                          <td className="px-5 py-3 text-right text-sm font-medium text-zinc-800">{fmtAUD(customer.total_spent ?? 0)}</td>
                          <td className="px-5 py-3">
                            {customer.last_order_number ? (
                              <div>
                                <p className="text-xs font-medium text-zinc-800">{customer.last_order_number}</p>
                                <p className="text-xs text-zinc-400">{fmtDate(customer.last_order_date)}</p>
                              </div>
                            ) : <span className="text-xs text-zinc-400">—</span>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
              <span>{startResult} — {endResult} of {count} results</span>
              <div className="flex items-center gap-3">
                <span>{page} of {totalPages} pages</span>
                <div className="flex gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => router.push(buildHref({ page: String(page - 1) }))}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
                  <button type="button" disabled={page >= totalPages} onClick={() => router.push(buildHref({ page: String(page + 1) }))}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            </div>
          </div>
        }
        panel={
          <CustomerFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            customerId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_CUSTOMER_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const c = customers.find(x => x.customer_id === selectedId)
              if (c) setDeleteTarget(c)
            }}
          />
        }
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 w-full max-w-sm">
            <p className="text-base font-semibold text-zinc-900 text-center">Delete Customer</p>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              Are you sure you want to delete <span className="font-medium text-zinc-700">{deleteTarget.email}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
