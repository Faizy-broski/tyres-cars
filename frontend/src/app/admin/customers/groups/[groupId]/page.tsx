'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { toastSuccess, toastError } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import type { CustomerGroup, CustomerListItem } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type GroupWithMembers = CustomerGroup & { members: CustomerListItem[] }

function AccountBadge({ isGuest }: { isGuest: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
      isGuest
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-green-200 bg-green-50 text-green-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isGuest ? 'bg-amber-500' : 'bg-green-500'}`} />
      {isGuest ? 'Guest' : 'Registered'}
    </span>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomerGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()

  const [group, setGroup]     = useState<GroupWithMembers | null>(null)
  const [token, setToken]     = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [removing, setRemoving] = useState<string | null>(null)

  const [addSearch, setAddSearch]   = useState('')
  const [addResults, setAddResults] = useState<CustomerListItem[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [adding, setAdding]         = useState<string | null>(null)
  const addSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    document.title = group ? `${group.group_name} | Tyres & Car Valeting` : 'Customer Group | Tyres & Car Valeting'
  }, [group])

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        if (!cancelled) setToken(tok)

        const res = await fetch(`${API}/api/admin/customers/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${res.status}`)
        }
        const json = await res.json()
        if (!cancelled) setGroup(json.group)
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load group')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [groupId, refreshKey])

  function handleAddSearchChange(q: string) {
    setAddSearch(q)
    if (addSearchRef.current) clearTimeout(addSearchRef.current)
    if (!q.trim()) { setAddResults([]); return }
    addSearchRef.current = setTimeout(async () => {
      setAddLoading(true)
      try {
        const res = await fetch(
          `${API}/api/admin/customers?search=${encodeURIComponent(q)}&page=1`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        const json = await res.json()
        setAddResults((json.customers ?? []).slice(0, 5))
      } finally {
        setAddLoading(false)
      }
    }, 300)
  }

  async function handleAddMember(customerId: string) {
    setAdding(customerId)
    try {
      const res = await fetch(
        `${API}/api/admin/customers/groups/${groupId}/members/${customerId}`,
        { method: 'PUT', headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to add member')
      }
      setAddSearch('')
      setAddResults([])
      setRefreshKey(k => k + 1)
      toastSuccess('Member added to group')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setAdding(null)
    }
  }

  async function handleRemoveMember(customerId: string, name: string) {
    setRemoving(customerId)
    try {
      const res = await fetch(
        `${API}/api/admin/customers/groups/${groupId}/members/${customerId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to remove member')
      }
      setGroup(g =>
        g ? { ...g, members: g.members.filter(m => m.customer_id !== customerId) } : null,
      )
      toastSuccess(`${name} removed from group`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Customers', href: '/admin/customers' }, { label: 'Group' }]} />
        <p className="mt-6 text-sm text-zinc-500">Group not found.</p>
      </div>
    )
  }

  const members = group.members ?? []
  const currentMemberIds = new Set(members.map(m => m.customer_id))

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Customers', href: '/admin/customers' },
          { label: 'Groups', href: '/admin/customers/groups' },
          { label: group.group_name },
        ]} />
      </div>

      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">{group.group_name}</h1>
        <div className="mt-3 flex items-center border-t border-zinc-100 pt-3">
          <span className="w-32 text-sm text-zinc-500">Members</span>
          <span className="text-sm font-medium text-zinc-800">{members.length}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Customers</h2>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={addSearch}
                  onChange={e => handleAddSearchChange(e.target.value)}
                  placeholder="Search customers by name or email to add…"
                  className="w-full rounded-lg border border-zinc-300 py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {addLoading && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
                  </div>
                )}
              </div>
            </div>

            {addResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-w-xs rounded-lg border border-zinc-200 bg-white shadow-lg">
                {addResults.map(c => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
                  const already = currentMemberIds.has(c.customer_id)
                  return (
                    <div key={c.customer_id} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 first:rounded-t-lg last:rounded-b-lg">
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{name}</p>
                        <p className="text-xs text-zinc-400">{c.email}</p>
                      </div>
                      {already ? (
                        <span className="text-xs text-zinc-400">Already in group</span>
                      ) : (
                        <Button
                          type="button"
                          size="xs"
                          disabled={adding === c.customer_id}
                          onClick={() => handleAddMember(c.customer_id)}
                        >
                          {adding === c.customer_id ? 'Adding…' : 'Add'}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Account</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Created</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 mx-auto">
                    <svg className="w-10 h-10 text-zinc-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    <p className="text-sm font-medium text-zinc-400">No customers in this group yet.</p>
                    <p className="text-xs text-zinc-300">Search above to add members.</p>
                  </div>
                </td>
              </tr>
            ) : (
              members.map(member => {
                const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email
                return (
                  <tr key={member.customer_id} className="even:bg-zinc-100/50 hover:bg-amber-50/70 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${member.customer_id}`} className="text-zinc-800 hover:underline">
                        {member.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{name}</td>
                    <td className="px-4 py-3">
                      <AccountBadge isGuest={!member.profile_id} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{fmt(member.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={removing === member.customer_id}
                        onClick={() => handleRemoveMember(member.customer_id, name)}
                        className="text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        {removing === member.customer_id ? 'Removing…' : 'Remove'}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
          <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}
