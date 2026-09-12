'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { StatusSelect } from '@/components/admin/StatusSelect'
import { PatternFormPanel, EMPTY_PATTERN_FORM, type PatternFormState } from '@/components/admin/brands/PatternFormPanel'
import { toastError, toastSuccess } from '@/lib/toast'
import { Trash2 } from 'lucide-react'
import { useAdminBrandsAll, useAdminPatterns, type AdminPattern, type PaginatedPatterns } from '@/lib/query/hooks'
import { adminKeys } from '@/lib/query/keys'
import { TableBodySpinner } from '@/components/ui/table-loader'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type PatternWithBrand = AdminPattern & { brand_name: string }
type Selected = { patternId: string; brandId: string; patternName: string }

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

// Raw shape from GET /brands/:brandId/patterns/:patternId (all `patterns` table columns + category join)
function toFormState(data: Record<string, unknown>): PatternFormState {
  const cats = Array.isArray(data.pattern_categories) ? data.pattern_categories as { category_id: string }[] : []
  return {
    pattern_name:              (data.pattern_name as string) ?? '',
    pattern_slug:              (data.pattern_slug as string) ?? '',
    pattern_short_description: (data.pattern_short_description as string) ?? '',
    pattern_description:       (data.pattern_description as string) ?? '',
    main_image:                (data.main_image as string) ?? '',
    tread_image:               (data.tread_image as string) ?? '',
    application_type:          (data.application_type as string) ?? 'PCR',
    season_type:                (data.season_type as string) ?? '',
    performance_category:      (data.performance_category as string) ?? '',
    position_category:         (data.position_category as string) ?? '',
    shoulder_type:              (data.shoulder_type as string) ?? '',
    terrain_type:               (data.terrain_type as string) ?? '',
    default_country_of_origin: (data.default_country_of_origin as string) ?? '',
    warranty_km:                data.warranty_km != null ? String(data.warranty_km) : '',
    seo_title:                  (data.seo_title as string) ?? '',
    seo_description:            (data.seo_description as string) ?? '',
    tyre_overview:               (data.tyre_overview as string) ?? '',
    features:                    (data.features as string) ?? '',
    warranty_information:        (data.warranty_information as string) ?? '',
    is_active:                  (data.is_active as boolean) ?? true,
    show_on_website:            (data.show_on_website as boolean) ?? false,
    on_sale:                    (data.on_sale as boolean) ?? false,
    discountable:                (data.discountable as boolean) ?? true,
    category_ids:                cats.map(c => c.category_id),
  }
}

function DeleteDialog({ pattern, onClose, onConfirm, deleting, skuError }: {
  pattern: Selected; onClose: () => void; onConfirm: () => void
  deleting: boolean; skuError: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 w-full max-w-sm">
        {skuError ? (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 text-center">Cannot Delete</h2>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              <span className="font-medium text-zinc-700">{pattern.patternName}</span> has SKUs linked to it.
              Remove all associated SKUs before deleting.
            </p>
            <button type="button" onClick={onClose}
              className="w-full rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
              Close
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 text-center">Delete Pattern</h2>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              Are you sure you want to delete <span className="font-medium text-zinc-700">{pattern.patternName}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={deleting}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={onConfirm} disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PatternsPage() {
  const searchParams = useSearchParams()
  const queryClient  = useQueryClient()

  const [page,        setPage]        = useState(1)
  const [limit,       setLimit]       = useState(50)
  const [filterBrand, setFilterBrand] = useState(searchParams.get('brand') ?? '')
  const [filterApp,   setFilterApp]   = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')

  const [selected,     setSelected]     = useState<Selected | null>(null)
  const [panelData,    setPanelData]    = useState<PatternFormState | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)

  const [toDelete, setToDelete] = useState<Selected | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [skuError, setSkuError] = useState(false)

  const { data: result,  isPending: patternsLoading } = useAdminPatterns({ page, limit, search, brandId: filterBrand || undefined, appType: filterApp || undefined })
  const { data: brands = [], isPending: brandsLoading } = useAdminBrandsAll()

  const loading    = patternsLoading || brandsLoading
  const rawPatterns = result?.data       ?? []
  const total       = result?.total      ?? 0
  const totalPages  = result?.totalPages ?? 1

  const brandMap = useMemo(
    () => Object.fromEntries(brands.map(b => [b.brand_id, b.brand_name])),
    [brands],
  )
  const patterns: PatternWithBrand[] = useMemo(
    () => rawPatterns.map(p => ({ ...p, brand_name: brandMap[p.brand_id] ?? '' })),
    [rawPatterns, brandMap],
  )

  // Guards against a fetch race: if the user clicks a different row (or a save
  // re-triggers a load) before an earlier fetch resolves, the earlier response
  // must never be allowed to overwrite the panel out from under the newer selection.
  const loadTokenRef = useRef(0)

  async function loadPatternIntoPanel(brandId: string, patternId: string, patternName: string) {
    const myToken = ++loadTokenRef.current
    setSelected({ patternId, brandId, patternName })
    setPanelData(null)
    setPanelLoading(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/products/brands/${brandId}/patterns/${patternId}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Failed to load pattern')
      const data = await res.json()
      if (loadTokenRef.current !== myToken) return // a newer selection/load has since started — discard this stale response
      setPanelData(toFormState(data))
      // fill in the real name for deep links that arrived without one (e.g. ?brand=&pattern=)
      const realName = (data.pattern_name as string) ?? patternName
      setSelected(prev => prev ? { ...prev, patternName: realName } : prev)
    } catch {
      if (loadTokenRef.current !== myToken) return
      toastError('Failed to load pattern details')
      setSelected(null)
    } finally {
      if (loadTokenRef.current === myToken) setPanelLoading(false)
    }
  }

  function handleNewPattern() {
    setSelected(null)
    setPanelData(null)
  }

  // Deep-link support: /admin/products/patterns?brand=X or ?brand=X&pattern=Y
  // replaces the old dedicated /new and /[patternId]/edit routes.
  useEffect(() => {
    const brandQ   = searchParams.get('brand')
    const patternQ = searchParams.get('pattern')
    if (brandQ && patternQ) {
      loadPatternIntoPanel(brandQ, patternQ, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaved(saved: { patternId: string; brandId: string; form: PatternFormState }) {
    const existing = patterns.find(p => p.pattern_id === saved.patternId)
    queryClient.invalidateQueries({ queryKey: adminKeys.brandListAll() })

    if (existing) {
      // Edit of an already-visible row: the panel's submitted form already has every field the
      // table displays — splice it in immediately and update the panel directly, instead of
      // (a) waiting on a second round-trip GET just to re-learn it and (b) flashing the panel's
      // "Loading pattern…" placeholder for data we already have.
      queryClient.setQueriesData<PaginatedPatterns>({ queryKey: ['admin', 'patterns', 'list'] }, old => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map(p => p.pattern_id === saved.patternId ? {
            ...p,
            pattern_name:     saved.form.pattern_name,
            pattern_slug:     saved.form.pattern_slug,
            application_type: saved.form.application_type,
            season_type:      saved.form.season_type || null,
            terrain_type:     saved.form.terrain_type || null,
            is_active:        saved.form.is_active,
            show_on_website:  saved.form.show_on_website,
          } : p),
        }
      })
      loadTokenRef.current++ // invalidate any still-in-flight loadPatternIntoPanel call from a previous selection
      setSelected({ patternId: saved.patternId, brandId: saved.brandId, patternName: saved.form.pattern_name })
      setPanelData(saved.form)
      setPanelLoading(false)
      // Reconcile with server truth in the background — deliberately delayed, not fired immediately.
      // An immediate refetch can win the race against the write it's meant to confirm and land a
      // moment later with pre-save data, silently stomping the correct value we just painted.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: adminKeys.patternList() }), 1500)
    } else {
      // Newly created record — no existing row to splice into, so a real refetch is unavoidable.
      queryClient.invalidateQueries({ queryKey: adminKeys.patternList() })
      await loadPatternIntoPanel(saved.brandId, saved.patternId, saved.form.pattern_name)
    }
  }

  async function patchPatternField(brandId: string, patternId: string, body: Record<string, boolean>) {
    const tok = await getToken()
    const res = await fetch(`${API}/api/admin/products/brands/${brandId}/patterns/${patternId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed')
    queryClient.invalidateQueries({ queryKey: adminKeys.patternList() })
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      const tok = await getToken()
      const res = await fetch(
        `${API}/api/admin/products/brands/${toDelete.brandId}/patterns/${toDelete.patternId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } },
      )
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string; code?: string }
        // 23503 = Postgres foreign-key violation. The only FK that can block a pattern
        // delete in this flow is skus.pattern_id, so this code alone is enough to know
        // it's the "has SKUs" case — the humanised .error text can't be string-matched
        // reliably (see error.middleware.ts's humanise()).
        if (b.code === '23503') {
          setSkuError(true)
          return
        }
        throw new Error(b.error || 'Failed to delete pattern')
      }
      queryClient.invalidateQueries({ queryKey: adminKeys.patternList() })
      queryClient.invalidateQueries({ queryKey: adminKeys.brandListAll() })
      toastSuccess(`"${toDelete.patternName}" deleted`)
      setToDelete(null)
      setSkuError(false)
      setSelected(null)
      setPanelData(null)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete pattern')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const displayed = patterns
  const appTypes  = useMemo(() => ['PCR', '4x4', 'TBR'], [])
  const sel = 'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/30'

  return (
    <>
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Products', href: '/admin/products' },
          { label: 'Patterns' },
        ]} />
      </div>

      <SplitView
        title="Patterns"
        description="All tyre patterns across every brand"
        headerAction={
          <>
            <button
              type="button"
              onClick={handleNewPattern}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-primary/90 transition-colors"
            >
              + New Pattern
            </button>
          </>
        }
        list={
          <>
            <div className="flex flex-wrap gap-2">
              <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex gap-2">
                <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search patterns…" className={sel + ' w-48'} />
                <button type="submit" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">Search</button>
              </form>
              <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setPage(1) }} className={sel}>
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
              </select>
              <select value={filterApp} onChange={e => { setFilterApp(e.target.value); setPage(1) }} className={sel}>
                <option value="">All Applications</option>
                {appTypes.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {(filterBrand || filterApp || search) && (
                <button type="button" onClick={() => { setFilterBrand(''); setFilterApp(''); setSearch(''); setSearchInput(''); setPage(1) }}
                  className="text-xs text-zinc-400 hover:text-zinc-700 px-2">
                  Clear
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-primary/10">
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Pattern</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Brand</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Terrain</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Website</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <TableBodySpinner />
                  ) : displayed.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-zinc-400">
                        {patterns.length === 0 ? 'No patterns yet. Add brands and create patterns under each brand.' : 'No patterns match your filters.'}
                      </td>
                    </tr>
                  ) : (
                    displayed.map(p => {
                      const isSelected = selected?.patternId === p.pattern_id
                      return (
                        <tr key={p.pattern_id}
                          className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${isSelected ? '!bg-primary/10' : ''}`}
                          onClick={() => loadPatternIntoPanel(p.brand_id, p.pattern_id, p.pattern_name)}
                        >
                          <td className="px-5 py-3">
                            <p className="font-medium text-zinc-900">{p.pattern_name}</p>
                            <p className="text-xs text-zinc-400 font-mono">{p.pattern_slug}</p>
                          </td>
                          <td className="px-5 py-3">{p.brand_name}</td>
                          <td className="px-5 py-3 text-xs text-zinc-500 capitalize">
                            {p.terrain_type?.replace(/_/g, ' ') ?? <span className="text-zinc-300">—</span>}
                          </td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <StatusSelect
                              value={p.is_active}
                              onChange={next => patchPatternField(p.brand_id, p.pattern_id, { is_active: next })}
                            />
                          </td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <StatusSelect
                              value={p.show_on_website}
                              trueLabel="VISIBLE"
                              falseLabel="HIDDEN"
                              onChange={next => patchPatternField(p.brand_id, p.pattern_id, { show_on_website: next })}
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
                    <span>{total.toLocaleString()} pattern{total !== 1 ? 's' : ''} total</span>
                    <div className="flex items-center gap-2">
                      <span>Rows per page:</span>
                      <select
                        value={limit}
                        onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Prev
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        }
        panel={
          panelLoading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-8 flex items-center justify-center text-sm text-zinc-400">
              Loading pattern…
            </div>
          ) : (
            <PatternFormPanel
              key={selected ? `${selected.brandId}:${selected.patternId}` : 'new'}
              mode={selected ? 'edit' : 'create'}
              patternId={selected?.patternId}
              brandId={selected?.brandId ?? searchParams.get('brand') ?? undefined}
              brands={brands}
              initial={panelData ?? EMPTY_PATTERN_FORM}
              onSaved={handleSaved}
              onRequestDelete={() => selected && setToDelete(selected)}
            />
          )
        }
      />

      {toDelete && (
        <DeleteDialog
          pattern={toDelete}
          onClose={() => { setToDelete(null); setSkuError(false) }}
          onConfirm={handleDelete}
          deleting={deleting}
          skuError={skuError}
        />
      )}
    </>
  )
}
