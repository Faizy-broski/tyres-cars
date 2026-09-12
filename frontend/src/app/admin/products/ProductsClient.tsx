'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import ProductsTable from '@/components/admin/products/ProductsTable'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { useProductList, useProductMeta, type ProductListResponse } from '@/lib/query/hooks'
import { createClient } from '@/lib/supabase/client'
import { toastPromise } from '@/lib/toast'
import { BoxSpinner } from '@/components/ui/table-loader'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const DEFAULT_LIMIT = 20

const STOCK_FILTERS = [
  { value: '',         label: 'All Stock'    },
  { value: 'in_stock', label: 'In Stock'     },
  { value: 'no_stock', label: 'Out of Stock' },
]

type Props = {
  initialProducts?: ProductListResponse
}

export default function ProductsClient({ initialProducts }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const search    = searchParams.get('search')    ?? ''

  const page      = Number(searchParams.get('page') ?? 1)
  const sortBy    = searchParams.get('sortBy')    ?? 'created_at'
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc'
  const brandId   = searchParams.get('brandId')   ?? ''
  const patternId = searchParams.get('patternId') ?? ''
  const status    = searchParams.get('status')    ?? ''
  const stock     = searchParams.get('stock')     ?? ''
  const limit     = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)

  const isDefaultView = page === 1 && limit === DEFAULT_LIMIT && !search && !brandId && !patternId && !status && !stock
    && sortBy === 'created_at' && sortOrder === 'desc'

  const metaQuery = useProductMeta()
  const listQuery = useProductList(
    { search, page, limit, sortBy, sortOrder, brandId, patternId, status, stock },
    { initialData: isDefaultView ? initialProducts : undefined },
  )

  const loading   = listQuery.isPending
  const products  = listQuery.data?.data ?? []
  const brands    = metaQuery.data?.brands ?? []
  const allPatterns = metaQuery.data?.patterns ?? []
  const count     = listQuery.data?.total  ?? 0

  const brandPatterns = brandId
    ? allPatterns.filter((p: { brand_id: string }) => p.brand_id === brandId)
    : []

  const totalPages = Math.ceil(count / limit)

  const buildHref = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams({ sortBy, sortOrder, search, page: String(page), limit: String(limit), brandId, patternId, status, stock })
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `${pathname}?${p}`
  }, [sortBy, sortOrder, search, page, limit, brandId, patternId, status, stock, pathname])

  function handleSort(col: string) {
    if (col === sortBy) {
      router.push(buildHref({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc', page: '1' }))
    } else {
      const defaultOrder = ['pattern_name', 'brand_name', 'variant_count'].includes(col) ? 'asc' : 'desc'
      router.push(buildHref({ sortBy: col, sortOrder: defaultOrder, page: '1' }))
    }
  }

  async function handleBulkUpdate(field: 'active' | 'publish', value: boolean) {
    if (selected.size === 0) return
    setBulkUpdating(true)

    queryClient.setQueriesData(
      { queryKey: ['admin', 'products', 'list'] },
      (old: ProductListResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(p =>
            selected.has(p.id)
              ? { ...p, [field === 'active' ? 'isActive' : 'showOnWebsite']: value }
              : p
          ),
        }
      },
    )

    const { data: { session } } = await createClient().auth.getSession()
    const tok = session?.access_token ?? ''
    const ids = Array.from(selected)

    const updatePromise = Promise.all(ids.map(pId =>
      fetch(`${API}/api/admin/products/${pId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ [field]: value }),
      }).then(res => { if (!res.ok) throw new Error('Failed') })
    ))

    try {
      await toastPromise(updatePromise, {
        loading: `Updating ${ids.length} products...`,
        success: `Updated ${ids.length} products successfully`,
        error: 'Failed to update some products'
      })
    } finally {
      await listQuery.refetch()
      setBulkUpdating(false)
      setSelected(new Set())
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <AdminBreadcrumb crumbs={[{ label: 'Products' }]} />
      </div>

      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/new"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Product
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-zinc-200">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={brandId}
              onChange={e => router.push(buildHref({ brandId: e.target.value, patternId: '', page: '1' }))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-colors cursor-pointer"
            >
              <option value="">All Brands</option>
              {brands.map(b => (
                <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>
              ))}
            </select>

            {brandId && brandPatterns.length > 0 && (
              <select
                value={patternId}
                onChange={e => router.push(buildHref({ patternId: e.target.value, page: '1' }))}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-colors cursor-pointer"
              >
                <option value="">All Patterns</option>
                {brandPatterns.map((p: { pattern_id: string; pattern_name: string }) => (
                  <option key={p.pattern_id} value={p.pattern_id}>{p.pattern_name}</option>
                ))}
              </select>
            )}

            <select
              value={status}
              onChange={e => router.push(buildHref({ status: e.target.value, page: '1' }))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-colors cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>

            <select
              value={stock}
              onChange={e => router.push(buildHref({ stock: e.target.value, page: '1' }))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-colors cursor-pointer"
            >
              {STOCK_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {(brandId || patternId || status || stock || search) && (
              <button
                type="button"
                onClick={() => router.push(buildHref({ brandId: '', patternId: '', status: '', stock: '', search: '', page: '1' }))}
                className="text-xs text-zinc-400 hover:text-red-600 transition-colors ml-1"
              >
                ✕ Clear filters
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
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text" name="search" defaultValue={search}
                placeholder="Search products…"
                className="pl-8 pr-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-48"
              />
            </form>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selected.size > 0 && (
          <div className="animate-in fade-in zoom-in-95 duration-200 border-b border-zinc-200">
            <div className="bg-zinc-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center bg-primary text-primary-foreground text-sm font-bold w-8 h-8 rounded-full shadow-sm">
                    {selected.size}
                  </div>
                  <span className="text-sm font-semibold tracking-wide">Selected</span>
                </div>
                
                <div className="hidden sm:block w-px h-8 bg-zinc-700/60"></div>

                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Active</span>
                    <div className="flex rounded-lg bg-zinc-800/80 p-1 border border-zinc-700/50 shadow-inner">
                      <button onClick={() => handleBulkUpdate('active', true)} disabled={bulkUpdating} className="px-4 py-1.5 text-xs font-semibold text-zinc-300 rounded-md hover:bg-emerald-500 hover:text-white hover:shadow-md disabled:opacity-50 transition-all">Yes</button>
                      <button onClick={() => handleBulkUpdate('active', false)} disabled={bulkUpdating} className="px-4 py-1.5 text-xs font-semibold text-zinc-300 rounded-md hover:bg-rose-500 hover:text-white hover:shadow-md disabled:opacity-50 transition-all">No</button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Website</span>
                    <div className="flex rounded-lg bg-zinc-800/80 p-1 border border-zinc-700/50 shadow-inner">
                      <button onClick={() => handleBulkUpdate('publish', true)} disabled={bulkUpdating} className="px-4 py-1.5 text-xs font-semibold text-zinc-300 rounded-md hover:bg-emerald-500 hover:text-white hover:shadow-md disabled:opacity-50 transition-all">Yes</button>
                      <button onClick={() => handleBulkUpdate('publish', false)} disabled={bulkUpdating} className="px-4 py-1.5 text-xs font-semibold text-zinc-300 rounded-md hover:bg-rose-500 hover:text-white hover:shadow-md disabled:opacity-50 transition-all">No</button>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={() => setSelected(new Set())} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors ml-4 shrink-0" title="Clear selection">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <BoxSpinner minHeight={320} />
        ) : (
          <div className="overflow-x-auto">
            <ProductsTable
              products={products}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 px-4 py-3 border-t border-zinc-200 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          {loading
            ? <div className="h-4 w-36 bg-zinc-100 rounded animate-pulse" />
            : (
              <div className="flex items-center gap-4">
                <span>{count === 0 ? '0 results' : `${(page - 1) * limit + 1}–${Math.min(page * limit, count)} of ${count} results`}</span>
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    value={limit}
                    onChange={e => router.push(buildHref({ limit: e.target.value, page: '1' }))}
                    className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            )
          }
          <div className="flex items-center gap-3">
            <span>{loading ? '…' : `Page ${page} of ${totalPages || 1}`}</span>
            <div className="flex gap-1">
              {page > 1 && (
                <Link href={buildHref({ page: String(page - 1) })} className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium">Prev</Link>
              )}
              {page < totalPages && (
                <Link href={buildHref({ page: String(page + 1) })} className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium">Next</Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
