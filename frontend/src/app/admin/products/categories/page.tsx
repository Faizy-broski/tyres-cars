'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAdminCategories } from '@/lib/query/hooks'
import { adminKeys } from '@/lib/query/keys'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { StatusSelect } from '@/components/admin/StatusSelect'
import { CategoryFormPanel, EMPTY_CATEGORY_FORM, categoryToForm, type CategoryFormState } from '@/components/admin/categories/CategoryFormPanel'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'
import { toastPromise } from '@/lib/toast'
import type { Category, CategoryType } from '@/types/admin.types'
import { TableBodySpinner } from '@/components/ui/table-loader'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CATEGORY_TYPES: CategoryType[] = ['season', 'application', 'performance', 'position', 'terrain']

const TYPE_COLOURS: Record<CategoryType, string> = {
  season:      'bg-blue-50 text-blue-700',
  application: 'bg-purple-50 text-purple-700',
  performance: 'bg-amber-50 text-amber-700',
  position:    'bg-teal-50 text-teal-700',
  terrain:     'bg-orange-50 text-orange-700',
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

export default function CategoriesPage() {
  const searchParams = useSearchParams()
  const queryClient  = useQueryClient()
  const { data: categories = [], isPending: loading, refetch } = useAdminCategories()

  const [filterType, setFilterType] = useState<CategoryType | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<CategoryFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { document.title = 'Categories | Tyre Vault' }, [])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminKeys.productCategories() })

  function selectCategory(c: Category) {
    setSelectedId(c.category_id)
    setSelectedForm(categoryToForm(c))
  }

  function handleNewCategory() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  async function handleSaved(saved: { categoryId: string; form: CategoryFormState }) {
    const existing = categories.find(c => c.category_id === saved.categoryId)

    if (existing) {
      // Edit of an already-visible row: we already know exactly what changed — splice it into the
      // cached list immediately instead of waiting on a second round-trip (GET) just to re-learn it.
      const merged: Category = {
        ...existing,
        ...saved.form,
        sort_order: saved.form.sort_order !== '' ? Number(saved.form.sort_order) : null,
      }
      queryClient.setQueryData<Category[]>(adminKeys.productCategories(), old =>
        old?.map(c => c.category_id === saved.categoryId ? merged : c))
      selectCategory(merged)
      // Reconcile with server truth in the background — deliberately delayed, not fired immediately.
      // An immediate refetch can win the race against the write it's meant to confirm and land a
      // moment later with pre-save data, silently stomping the correct value we just painted.
      setTimeout(() => refetch(), 1500)
    } else {
      // Newly created record — no existing row to splice into, so a real refetch is unavoidable.
      const { data: fresh } = await refetch()
      const found = fresh?.find(c => c.category_id === saved.categoryId)
      if (found) selectCategory(found)
    }
  }

  async function patchCategoryField(categoryId: string, body: Record<string, boolean>) {
    const tok = await getToken()
    const res = await fetch(`${API}/api/admin/products/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed')
    invalidate()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const tok = await getToken()
    const req = fetch(`${API}/api/admin/products/categories/${deleteTarget.category_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    }).then(async res => {
      if (!res.ok) throw new Error(await res.json().then((b: { error?: string }) => b.error ?? 'Failed'))
    })
    try {
      await toastPromise(req, {
        loading: `Deleting "${deleteTarget.category_name}"…`,
        success: `"${deleteTarget.category_name}" deleted`,
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to delete',
      })
      invalidate()
      if (selectedId === deleteTarget.category_id) { setSelectedId(null); setSelectedForm(null) }
      setDeleteTarget(null)
    } catch { /* shown */ } finally { setDeleting(false) }
  }

  // Deep link: /admin/products/categories?category=X selects that category once loaded.
  useEffect(() => {
    const catQ = searchParams.get('category')
    if (catQ && !selectedId && categories.length > 0) {
      const found = categories.find(c => c.category_id === catQ)
      if (found) selectCategory(found)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  const displayed = filterType ? categories.filter(c => c.category_type === filterType) : categories

  return (
    <>
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Products', href: '/admin/products' },
          { label: 'Categories' },
        ]} />
      </div>

      <SplitView
        title="Categories"
        description="Classify tyres by season, application, performance, position, and terrain"
        headerAction={
          <>
            <Link href="/admin/products/import?type=categories"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Bulk Import
            </Link>
            <button
              type="button"
              onClick={handleNewCategory}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm"
            >
              + New Category
            </button>
          </>
        }
        list={
          <>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType('')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!filterType ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                All ({categories.length})
              </button>
              {CATEGORY_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t === filterType ? '' : t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${filterType === t ? `${TYPE_COLOURS[t]} ring-1 ring-inset ring-current` : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                >
                  {t} ({categories.filter(c => c.category_type === t).length})
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-primary/10">
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide">Website</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <TableBodySpinner colSpan={4} />
                  ) : displayed.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-zinc-400">
                        {filterType ? `No ${filterType} categories yet.` : 'No categories yet.'}
                      </td>
                    </tr>
                  ) : (
                    displayed.map(c => {
                      const isSelected = selectedId === c.category_id
                      return (
                        <tr key={c.category_id}
                          className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${isSelected ? '!bg-primary/10' : ''}`}
                          onClick={() => selectCategory(c)}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              {c.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.image} alt="" className="h-7 w-7 object-cover rounded border border-zinc-200 shrink-0" />
                              )}
                              <div>
                                <span className="font-medium text-zinc-900">{c.category_name}</span>
                                <p className="text-xs text-zinc-400 font-mono">{c.category_slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <Badge className={`text-xs rounded-full border-0 capitalize ${TYPE_COLOURS[c.category_type as CategoryType] ?? 'bg-zinc-100 text-zinc-600'}`}>
                              {c.category_type}
                            </Badge>
                          </td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <StatusSelect
                              value={c.is_active}
                              onChange={next => patchCategoryField(c.category_id, { is_active: next })}
                            />
                          </td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <StatusSelect
                              value={c.hidden_from_website}
                              invert
                              trueLabel="HIDDEN"
                              falseLabel="VISIBLE"
                              onChange={next => patchCategoryField(c.category_id, { hidden_from_website: next })}
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        }
        panel={
          <CategoryFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            categoryId={selectedId ?? undefined}
            categories={categories}
            initial={selectedForm ?? EMPTY_CATEGORY_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const c = categories.find(x => x.category_id === selectedId)
              if (c) setDeleteTarget(c)
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
            <h2 className="text-base font-semibold text-zinc-900 text-center">Delete Category</h2>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              Delete <span className="font-medium text-zinc-700">{deleteTarget.category_name}</span>? This cannot be undone.
              Child categories will lose their parent reference.
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
