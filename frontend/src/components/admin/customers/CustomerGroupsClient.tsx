'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { CustomerGroupFormPanel, EMPTY_CUSTOMER_GROUP_FORM, groupToForm, type CustomerGroupFormState } from './CustomerGroupFormPanel'
import { toastSuccess, toastError } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CustomerGroup } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

type Props = {
  accessToken: string
  groups: CustomerGroup[]
  total: number
  totalPages: number
  page: number
  search: string
}

export default function CustomerGroupsClient({
  accessToken,
  groups,
  total,
  totalPages,
  page,
  search,
}: Props) {
  const router = useRouter()
  const [localSearch, setLocalSearch] = useState(search)
  const [localGroups, setLocalGroups] = useState<CustomerGroup[]>(groups)

  useEffect(() => { setLocalGroups(groups) }, [groups])

  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [selectedForm, setSelectedForm]     = useState<CustomerGroupFormState | null>(null)
  const [deleteTarget, setDeleteTarget]     = useState<CustomerGroup | null>(null)
  const [deleting, setDeleting]             = useState(false)

  function selectGroup(group: CustomerGroup) {
    setSelectedId(group.group_id)
    setSelectedForm(groupToForm(group))
  }

  function handleNewGroup() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  function handleSaved(saved: CustomerGroup) {
    if (selectedId) {
      setLocalGroups(prev => prev.map(g => g.group_id === saved.group_id ? { ...g, ...saved } : g))
    } else {
      router.refresh()
    }
    setSelectedId(saved.group_id)
    setSelectedForm(groupToForm(saved))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/admin/customers/groups/${deleteTarget.group_id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to delete group')
      }
      setLocalGroups(prev => prev.filter(g => g.group_id !== deleteTarget.group_id))
      toastSuccess(`Group "${deleteTarget.group_name}" deleted`)
      if (selectedId === deleteTarget.group_id) {
        setSelectedId(null)
        setSelectedForm(null)
      }
      setDeleteTarget(null)
      router.refresh()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to delete group')
    } finally {
      setDeleting(false)
    }
  }

  const startResult = total === 0 ? 0 : (page - 1) * 20 + 1
  const endResult   = total === 0 ? 0 : (page - 1) * 20 + localGroups.length

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(
      `/admin/customers/groups?search=${encodeURIComponent(localSearch)}&page=1`,
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb
        crumbs={[
          { label: 'Customers', href: '/admin/customers' },
          { label: 'Groups' },
        ]}
      />

      <SplitView
        title="Customer Groups"
        description="Segment customers for pricing, discounts, and access tiers"
        panelWidthClassName="w-full lg:w-[440px] xl:w-[480px]"
        headerAction={
          <button
            type="button"
            onClick={handleNewGroup}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Create Group
          </button>
        }
        list={
          <div className="space-y-4">
            {/* Search filter */}
            <div className="flex items-center justify-between gap-3">
              <form onSubmit={submitSearch} className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Search groups..."
                  className="pl-8 text-xs"
                />
              </form>
              <span className="text-xs text-zinc-400">{total} group{total !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Group Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Customers</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Discount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Price Tier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {localGroups.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-400">
                          {search ? `No groups matching "${search}"` : 'No customer groups yet.'}
                        </td>
                      </tr>
                    ) : (
                      localGroups.map((group) => {
                        const isSelected = selectedId === group.group_id
                        return (
                          <tr
                            key={group.group_id}
                            className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                              isSelected ? '!bg-primary/10' : ''
                            }`}
                            onClick={() => selectGroup(group)}
                          >
                            <td className="px-4 py-3 font-semibold text-zinc-900 whitespace-nowrap">
                              <Link
                                href={`/admin/customers/groups/${group.group_id}`}
                                className="hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                {group.group_name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-xs font-medium whitespace-nowrap">
                              {group.customer_count}
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">
                              {group.discount_type && group.discount_value != null ? (
                                <span className="font-medium text-zinc-800">
                                  {group.discount_type === 'percent' ? `${group.discount_value}%` : `$${group.discount_value}`}
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              {group.price_type ? (
                                <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium capitalize">
                                  {group.price_type}
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                              {fmtDateTime(group.updated_at)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 text-xs text-zinc-500 bg-white">
                  <span>
                    {startResult} — {endResult} of {total} results
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => router.push(`/admin/customers/groups?page=${page - 1}${search ? `&search=${search}` : ''}`)}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 font-medium text-zinc-700">{page} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => router.push(`/admin/customers/groups?page=${page + 1}${search ? `&search=${search}` : ''}`)}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        panel={
          <CustomerGroupFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            groupId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_CUSTOMER_GROUP_FORM}
            accessToken={accessToken}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const target = localGroups.find(g => g.group_id === selectedId)
              if (target) setDeleteTarget(target)
            }}
          />
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer Group?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            Delete <strong>{deleteTarget?.group_name}</strong>? Customers in this group will be moved to the default group.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
