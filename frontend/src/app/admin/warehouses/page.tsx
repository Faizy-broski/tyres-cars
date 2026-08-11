'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminWarehouses } from '@/lib/query/hooks'
import { adminKeys } from '@/lib/query/keys'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { StatusSelect } from '@/components/admin/StatusSelect'
import { WarehouseFormPanel, EMPTY_WAREHOUSE_FORM, warehouseToForm, type WarehouseFormState } from '@/components/admin/warehouses/WarehouseFormPanel'
import { Trash2 } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { Warehouse } from '@/types/admin.types'
import { BoxSpinner } from '@/components/ui/table-loader'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const TYPE_COLOURS: Record<string, string> = {
  own:      'bg-green-50 text-green-700',
  supplier: 'bg-blue-50 text-blue-700',
  '3pl':    'bg-purple-50 text-purple-700',
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

export default function WarehousesPage() {
  const searchParams = useSearchParams()
  const queryClient  = useQueryClient()
  const [showInactive, setShowInactive] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<WarehouseFormState | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const { data: warehouses = [], isPending: loading } = useAdminWarehouses(showInactive)

  function selectWarehouse(w: Warehouse) {
    setSelectedId(w.warehouse_id)
    setSelectedForm(warehouseToForm(w))
  }

  function handleNewWarehouse() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: adminKeys.warehouseList(showInactive) })
  }

  async function patchWarehouseField(warehouseId: string, body: Record<string, boolean>) {
    const tok = await getToken()
    const res = await fetch(`${API}/api/admin/orders/warehouses/${warehouseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed')
    queryClient.invalidateQueries({ queryKey: adminKeys.warehouseList(showInactive) })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const tok = await getToken()
      const res = await fetch(`${API}/api/admin/orders/warehouses/${deleteTarget.warehouse_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      toastSuccess('Warehouse deleted')
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: adminKeys.warehouseList(showInactive) })
      if (selectedId === deleteTarget.warehouse_id) { setSelectedId(null); setSelectedForm(null) }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // Deep link: /admin/warehouses?warehouse=X selects that warehouse once loaded.
  useEffect(() => {
    const whQ = searchParams.get('warehouse')
    if (whQ && !selectedId && warehouses.length > 0) {
      const found = warehouses.find(w => w.warehouse_id === whQ)
      if (found) selectWarehouse(found)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses])

  return (
    <>
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <AdminBreadcrumb crumbs={[{ label: 'Warehouses' }]} />
      </div>

      <SplitView
        title="Warehouses"
        description="Manage own, supplier, and 3PL warehouse locations"
        headerAction={
          <>
            <label className="flex items-center gap-1.5 text-sm text-zinc-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="rounded border-zinc-300"
              />
              Show inactive
            </label>
            <button
              type="button"
              onClick={handleNewWarehouse}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm"
            >
              + Add Warehouse
            </button>
          </>
        }
        list={
          loading ? (
            <BoxSpinner />
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {warehouses.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">No warehouses yet</td></tr>
                  )}
                  {warehouses.map(w => {
                    const isSelected = selectedId === w.warehouse_id
                    return (
                      <tr key={w.warehouse_id}
                        className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${isSelected ? '!bg-primary/10' : ''}`}
                        onClick={() => selectWarehouse(w)}
                      >
                        <td className="px-4 py-3 font-medium text-zinc-900">{w.warehouse_name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium uppercase ${TYPE_COLOURS[w.warehouse_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                            {w.warehouse_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">
                          {[w.suburb, w.state, w.postcode].filter(Boolean).join(', ') || w.state}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">
                          {w.contact_name
                            ? <span>{w.contact_name}{w.contact_phone && <><br />{w.contact_phone}</>}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <StatusSelect
                            value={w.is_active}
                            onChange={next => patchWarehouseField(w.warehouse_id, { is_active: next })}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }
        panel={
          <WarehouseFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            warehouseId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_WAREHOUSE_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const w = warehouses.find(x => x.warehouse_id === selectedId)
              if (w) setDeleteTarget(w)
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
            <h2 className="text-base font-semibold text-zinc-900 text-center">Delete Warehouse?</h2>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              <strong>{deleteTarget.warehouse_name}</strong> will be permanently removed. This will fail if stock is assigned to this warehouse.
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
