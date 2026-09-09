'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import MappingInterface from '@/components/admin/suppliers/MappingInterface'
import type { Supplier } from '@/types/admin.types'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function MappingPage() {
  const { id } = useParams<{ id: string }>()

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [token, setToken]       = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        if (!cancelled) setToken(tok)

        const res = await fetch(`${API}/api/admin/suppliers/${id}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data = await res.json()
        if (!cancelled) setSupplier(data)
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load supplier')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    document.title = supplier
      ? `${supplier.supplier_name} — Mapping | Tyres & Car Valeting`
      : 'Mapping | Tyres & Car Valeting'
  }, [supplier])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="h-6 w-56 bg-zinc-100 rounded animate-pulse" />
        <div className="h-12 bg-zinc-100 rounded-xl animate-pulse" />
        <div className="h-96 bg-zinc-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  const supplierName = supplier?.supplier_name ?? id

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <AdminBreadcrumb crumbs={[
          { label: 'Suppliers',    href: '/admin/suppliers' },
          { label: supplierName,   href: `/admin/suppliers/${id}` },
          { label: 'Mapping' },
        ]} />
      </div>

      <MappingInterface
        supplierId={id}
        supplierName={supplierName}
        connectionType={supplier?.connection_type ?? 'manual'}
        accessToken={token}
      />
    </div>
  )
}
