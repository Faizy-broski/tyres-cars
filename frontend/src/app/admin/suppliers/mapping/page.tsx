'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { toastError } from '@/lib/toast'
import type { Supplier } from '@/types/admin.types'
import MappingInterface from '@/components/admin/suppliers/MappingInterface'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function SupplierMappingPage() {
  const [suppliers, setSuppliers]         = useState<Supplier[]>([])
  const [selectedId, setSelectedId]       = useState<string>('')
  const [token, setToken]                 = useState('')
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    document.title = 'Mapping Interface | Tyres & Car Valeting'
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        if (!cancelled) setToken(tok)

        const res = await fetch(`${API}/api/admin/suppliers`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data: Supplier[] = await res.json()
        if (!cancelled) {
          const active = Array.isArray(data) ? data.filter(s => s.is_active) : []
          setSuppliers(active)
          if (active.length > 0) setSelectedId(active[0].supplier_id)
        }
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load suppliers')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const selected = suppliers.find(s => s.supplier_id === selectedId)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <AdminBreadcrumb crumbs={[
          { label: 'Suppliers', href: '/admin/suppliers' },
          { label: 'Mapping Interface' },
        ]} />
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Mapping Interface</h1>

        {/* Supplier selector */}
        {loading ? (
          <div className="h-9 w-52 bg-zinc-100 rounded-lg animate-pulse" />
        ) : (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {suppliers.length === 0 && (
              <option value="">No active suppliers</option>
            )}
            {suppliers.map(s => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!loading && !selectedId && (
        <p className="text-sm text-zinc-500">
          No active suppliers found. Add a supplier first from the{' '}
          <a href="/admin/suppliers" className="text-blue-600 hover:underline">Suppliers list</a>.
        </p>
      )}

      {selectedId && selected && token && (
        <MappingInterface
          key={selectedId}
          supplierId={selectedId}
          supplierName={selected.supplier_name}
          connectionType={selected.connection_type ?? 'manual'}
          accessToken={token}
        />
      )}
    </div>
  )
}
