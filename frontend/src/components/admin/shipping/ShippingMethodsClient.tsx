'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ShippingMethodFormPanel, EMPTY_SHIPPING_METHOD_FORM, shippingMethodToForm, type ShippingMethodFormState } from '@/components/admin/shipping/ShippingMethodFormPanel'
import { Plus } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { AdminShippingMethod, ShippingMethodType } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const METHOD_TYPES: { value: ShippingMethodType; label: string }[] = [
  { value: 'own_fleet',       label: 'Own Fleet' },
  { value: 'courier_api',     label: 'Courier API' },
  { value: '3pl',             label: '3PL' },
  { value: 'supplier_direct', label: 'Supplier Direct' },
  { value: 'pickup',          label: 'Pickup' },
]

const TYPE_COLOURS: Record<ShippingMethodType, string> = {
  own_fleet:       'bg-green-50 text-green-700',
  courier_api:     'bg-blue-50 text-blue-700',
  '3pl':           'bg-purple-50 text-purple-700',
  supplier_direct: 'bg-amber-50 text-amber-700',
  pickup:          'bg-zinc-100 text-zinc-600',
}

type Props = {
  accessToken:  string
  methods:      AdminShippingMethod[]
  showInactive: boolean
}

export default function ShippingMethodsClient({ accessToken, methods, showInactive }: Props) {
  const router = useRouter()

  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [selectedForm, setSelectedForm]     = useState<ShippingMethodFormState | null>(null)
  const [deleteTarget, setDeleteTarget]     = useState<AdminShippingMethod | null>(null)
  const [deleting, setDeleting]             = useState(false)

  function toggleInactive(checked: boolean) {
    router.push(checked ? '/admin/shipping-methods?inactive=1' : '/admin/shipping-methods')
  }

  function selectMethod(m: AdminShippingMethod) {
    setSelectedId(m.shipping_method_id)
    setSelectedForm(shippingMethodToForm(m))
  }

  function handleNewMethod() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  function handleSaved() {
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/admin/shipping/methods/${deleteTarget.shipping_method_id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Delete failed')
      }
      toastSuccess('Shipping method deleted')
      if (selectedId === deleteTarget.shipping_method_id) {
        setSelectedId(null)
        setSelectedForm(null)
      }
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb crumbs={[{ label: 'Shipping Methods' }]} />

      <SplitView
        title="Shipping Methods"
        description="Configure couriers, own fleet, 3PL, and pickup options"
        panelWidthClassName="w-full lg:w-[420px] xl:w-[460px]"
        headerAction={
          <>
            <label className="flex items-center gap-1.5 text-sm text-zinc-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => toggleInactive(e.target.checked)}
                className="rounded border-zinc-300"
              />
              Show inactive
            </label>
            <button
              type="button"
              onClick={handleNewMethod}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Method
            </button>
          </>
        }
        list={
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Method Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">API / Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {methods.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-sm text-zinc-400">
                        No shipping methods yet.
                      </td>
                    </tr>
                  ) : (
                    methods.map(m => {
                      const isSelected = selectedId === m.shipping_method_id
                      return (
                        <tr
                          key={m.shipping_method_id}
                          className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                            isSelected ? '!bg-primary/10' : ''
                          }`}
                          onClick={() => selectMethod(m)}
                        >
                          <td className="px-4 py-3 font-semibold text-zinc-900 whitespace-nowrap">{m.method_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {m.method_type ? (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${TYPE_COLOURS[m.method_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                {METHOD_TYPES.find(t => t.value === m.method_type)?.label ?? m.method_type}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-xs font-mono whitespace-nowrap">{m.api_provider ?? '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge className={m.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                              {m.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        }
        panel={
          <ShippingMethodFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            methodId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_SHIPPING_METHOD_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const target = methods.find(m => m.shipping_method_id === selectedId)
              if (target) setDeleteTarget(target)
            }}
          />
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Shipping Method?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            Delete <span className="font-semibold text-zinc-900">{deleteTarget?.method_name}</span>? This cannot be undone and will fail if the method is linked to existing quotes or shipments.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
