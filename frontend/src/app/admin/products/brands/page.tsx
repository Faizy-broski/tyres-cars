'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { StatusSelect } from '@/components/admin/StatusSelect'
import { BrandFormPanel, EMPTY_BRAND_FORM, brandToForm, type BrandFormState } from '@/components/admin/brands/BrandFormPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toastPromise, toastError } from '@/lib/toast'
import type { Brand } from '@/types/admin.types'
import { useAdminBrands } from '@/lib/query/hooks'
import { adminKeys } from '@/lib/query/keys'
import { TableBodySpinner } from '@/components/ui/table-loader'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const POSITIONING_COLOURS: Record<string, string> = {
  budget:     'bg-zinc-100 text-zinc-600',
  mid_range:  'bg-blue-50 text-blue-700',
  premium:    'bg-amber-50 text-amber-700',
  commercial: 'bg-purple-50 text-purple-700',
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

export default function BrandsPage() {
  const searchParams = useSearchParams()
  const queryClient  = useQueryClient()

  const [page, setPage]               = useState(1)
  const [limit, setLimit]             = useState(50)
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<BrandFormState | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<Brand | null>(null)
  const [deleting, setDeleting]           = useState(false)

  const { data: result, isPending: loading } = useAdminBrands({ page, limit, search })
  const brands     = result?.data     ?? []
  const totalPages = result?.totalPages ?? 1
  const total      = result?.total    ?? 0

  function selectBrand(brand: Brand) {
    setSelectedId(brand.brand_id)
    setSelectedForm(brandToForm(brand))
  }

  function handleNewBrand() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: adminKeys.brandList() })
    queryClient.invalidateQueries({ queryKey: adminKeys.brandListAll() })
    // list refetch will bring the updated/created row; leave the panel as-is (edit mode already, or
    // create mode falls back to a blank form again since we don't know the new id's full record yet).
  }

  async function patchBrandField(brandId: string, body: Record<string, boolean>) {
    const tok = await getToken()
    const res = await fetch(`${API}/api/admin/products/brands/${brandId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed')
    queryClient.invalidateQueries({ queryKey: adminKeys.brandList() })
  }

  async function handleDelete(brand: Brand) {
    setDeleting(true)
    const tok = await getToken()
    const req = fetch(`${API}/api/admin/products/brands/${brand.brand_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    }).then(async res => {
      if (!res.ok) throw new Error(await res.json().then((b: { error?: string }) => b.error ?? 'Failed'))
    })

    try {
      await toastPromise(req, {
        loading: `Deleting "${brand.brand_name}"…`,
        success: `"${brand.brand_name}" deleted`,
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to delete',
      })
      queryClient.invalidateQueries({ queryKey: adminKeys.brandList() })
      queryClient.invalidateQueries({ queryKey: adminKeys.brandListAll() })
      setDeleteConfirm(null)
      if (selectedId === brand.brand_id) { setSelectedId(null); setSelectedForm(null) }
    } catch {
      // shown by toastPromise
    } finally {
      setDeleting(false)
    }
  }

  // Deep link: /admin/products/brands?brand=X selects that brand once the list has loaded.
  useEffect(() => {
    const brandQ = searchParams.get('brand')
    if (brandQ && !selectedId && brands.length > 0) {
      const found = brands.find(b => b.brand_id === brandQ)
      if (found) selectBrand(found)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands])

  return (
    <>
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Products', href: '/admin/products' },
          { label: 'Brands' },
        ]} />
      </div>

      <SplitView
        title="Brands"
        description="Manage tyre brand identities, logos, and positioning"
        headerAction={
          <>
            <Link
              href="/admin/products/import?type=brands"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Bulk Import
            </Link>
            <button
              type="button"
              onClick={handleNewBrand}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm"
            >
              + New Brand
            </button>
          </>
        }
        list={
          <>
            <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search brands…"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/30 w-56"
              />
              <Button type="submit" variant="outline" size="sm">Search</Button>
              {search && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}>
                  Clear
                </Button>
              )}
            </form>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Website</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <TableBodySpinner />
                  ) : brands.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center text-zinc-400">
                        No brands yet. Use "+ New Brand" to create one.
                      </td>
                    </tr>
                  ) : (
                    brands.map(brand => {
                      const isSelected = selectedId === brand.brand_id
                      return (
                        <tr key={brand.brand_id}
                          className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${isSelected ? '!bg-primary/10' : ''}`}
                          onClick={() => selectBrand(brand)}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              {brand.brand_logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={brand.brand_logo} alt="" className="h-8 w-8 object-contain rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 shrink-0" />
                              ) : (
                                <div className="h-8 w-8 rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs font-bold shrink-0">
                                  {brand.brand_name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-zinc-900">{brand.brand_name}</p>
                                {brand.brand_short_description && (
                                  <p className="text-xs text-zinc-400 truncate max-w-xs">{brand.brand_short_description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {brand.brand_positioning ? (
                              <Badge className={`text-xs rounded-full border-0 capitalize ${POSITIONING_COLOURS[brand.brand_positioning] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                {brand.brand_positioning.replace('_', ' ')}
                              </Badge>
                            ) : <span className="text-zinc-300">—</span>}
                          </td>
                          <td className="px-5 py-3 text-zinc-600 text-xs">{brand.country_of_brand ?? '—'}</td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <StatusSelect
                              value={brand.is_active}
                              onChange={next => patchBrandField(brand.brand_id, { is_active: next })}
                            />
                          </td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <StatusSelect
                              value={brand.show_on_website}
                              trueLabel="VISIBLE"
                              falseLabel="HIDDEN"
                              onChange={next => patchBrandField(brand.brand_id, { show_on_website: next })}
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

              {!loading && total > 0 && (
                <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-4">
                    <span>{total} brand{total !== 1 ? 's' : ''} total</span>
                    <div className="flex items-center gap-2">
                      <span>Rows per page:</span>
                      <select
                        value={limit}
                        onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span>Page {page} of {totalPages}</span>
                    <Button variant="outline" size="icon-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        }
        panel={
          <BrandFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            brandId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_BRAND_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const b = brands.find(x => x.brand_id === selectedId)
              if (b) setDeleteConfirm(b)
            }}
          />
        }
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 text-center">Delete Brand</h2>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              Are you sure you want to delete <span className="font-medium text-zinc-700">{deleteConfirm.brand_name}</span>?
              This cannot be undone and may affect products linked to this brand.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
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
