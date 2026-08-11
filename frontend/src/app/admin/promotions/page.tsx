'use client'

import { useCallback, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { TableBodySpinner } from '@/components/ui/table-loader'
import { usePromotionList, type PromotionRow } from '@/lib/query/hooks'
import { createClient } from '@/lib/supabase/client'
import { toastSuccess, toastError } from '@/lib/toast'
import { useQueryClient } from '@tanstack/react-query'
import { adminKeys } from '@/lib/query/keys'
import { Trash2 } from 'lucide-react'
import { PromotionFormPanel, EMPTY_PROMOTION_FORM, promotionToForm, type PromotionFormState } from '@/components/admin/promotions/PromotionFormPanel'

const API   = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const LIMIT = 20

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

function promotionStatus(p: PromotionRow): { label: string; cls: string } {
  const today = new Date().toISOString().slice(0, 10)
  if (!p.is_active)             return { label: 'Inactive',  cls: 'bg-zinc-100 text-zinc-500' }
  if (p.start_date > today)     return { label: 'Scheduled', cls: 'bg-blue-50 text-blue-600'  }
  if (p.end_date   < today)     return { label: 'Expired',   cls: 'bg-red-50 text-red-500'    }
  return                               { label: 'Active',    cls: 'bg-green-50 text-green-600' }
}

function discountLabel(p: PromotionRow): string {
  if (p.discount_type === 'percent')      return `${p.discount_value}% off`
  if (p.discount_type === 'fixed_amount') return `Rs. ${p.discount_value} off`
  return 'Bundle'
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminPromotionsPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()
  const qc           = useQueryClient()

  const search = searchParams.get('search') ?? ''
  const page   = Number(searchParams.get('page') ?? 1)

  const listQuery  = usePromotionList({ page, search })
  const loading    = listQuery.isPending
  const promotions = listQuery.data?.data  ?? []
  const count      = listQuery.data?.total ?? 0
  const totalPages = Math.ceil(count / LIMIT)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<PromotionFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PromotionRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const buildHref = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams({ search, page: String(page) })
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `${pathname}?${p}`
  }, [search, page, pathname])

  function selectPromotion(p: PromotionRow) {
    setSelectedId(p.promotion_id)
    setSelectedForm(promotionToForm(p))
  }

  function handleNewPromotion() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: adminKeys.promotionList({}) })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/promotions/${deleteTarget.promotion_id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      toastSuccess('Promotion deleted')
      qc.invalidateQueries({ queryKey: adminKeys.promotionList({}) })
      if (selectedId === deleteTarget.promotion_id) { setSelectedId(null); setSelectedForm(null) }
      setDeleteTarget(null)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <AdminBreadcrumb crumbs={[{ label: 'Promotions' }]} />
      </div>

      <SplitView
        title="Promotions"
        headerAction={
          <button
            type="button"
            onClick={handleNewPromotion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-primary/90 transition-colors"
          >
            + New Promotion
          </button>
        }
        list={
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-zinc-200">
              <form onSubmit={e => {
                e.preventDefault()
                const q = (new FormData(e.currentTarget).get('search') as string) ?? ''
                router.push(buildHref({ search: q, page: '1' }))
              }} className="relative w-full max-w-xs">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" name="search" defaultValue={search} placeholder="Search promotions…"
                  className="pl-8 pr-3 py-1.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-full" />
              </form>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    {['', 'Title', 'Discount', 'Period', 'Status', 'Homepage'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <TableBodySpinner />
                  ) : promotions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">
                        {search ? `No promotions matching "${search}"` : 'No promotions yet. Create one to get started.'}
                      </td>
                    </tr>
                  ) : promotions.map(p => {
                    const status = promotionStatus(p)
                    const isSelected = selectedId === p.promotion_id
                    return (
                      <tr key={p.promotion_id}
                        className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${isSelected ? '!bg-primary/10' : ''}`}
                        onClick={() => selectPromotion(p)}
                      >
                        {/* Thumbnail */}
                        <td className="pl-4 pr-2 py-3">
                          <div className="relative h-11 w-9 overflow-hidden rounded-lg bg-zinc-100 flex-shrink-0">
                            {p.image_url && p.image_url.startsWith('http') ? (
                              <Image src={p.image_url} alt={p.title} fill className="object-cover" sizes="36px" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900" />
                            )}
                          </div>
                        </td>

                        {/* Title + brand */}
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-zinc-900 truncate">{p.title}</p>
                          {p.brand_name && (
                            <p className="text-xs text-zinc-400 mt-0.5">{p.brand_name}</p>
                          )}
                        </td>

                        {/* Discount */}
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-700">{discountLabel(p)}</td>

                        {/* Period */}
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-500 text-xs">
                          {formatDate(p.start_date)}<br />{formatDate(p.end_date)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>

                        {/* Homepage */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${p.show_on_homepage ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {p.show_on_homepage ? 'YES' : 'NO'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-2 px-4 py-3 border-t border-zinc-200 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
              {loading
                ? <div className="h-4 w-36 bg-zinc-100 rounded animate-pulse" />
                : <span>{count === 0 ? '0 results' : `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, count)} of ${count}`}</span>
              }
              <div className="flex items-center gap-3">
                <span>{loading ? '…' : `Page ${page} of ${totalPages || 1}`}</span>
                <div className="flex gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => router.push(buildHref({ page: String(page - 1) }))}
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
                  <button type="button" disabled={page >= totalPages} onClick={() => router.push(buildHref({ page: String(page + 1) }))}
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            </div>
          </div>
        }
        panel={
          <PromotionFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            promotionId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_PROMOTION_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const p = promotions.find(x => x.promotion_id === selectedId)
              if (p) setDeleteTarget(p)
            }}
          />
        }
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 text-center">Delete Promotion</h2>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              Delete <span className="font-medium text-zinc-700">{deleteTarget.title}</span>? This cannot be undone.
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
    </div>
  )
}
