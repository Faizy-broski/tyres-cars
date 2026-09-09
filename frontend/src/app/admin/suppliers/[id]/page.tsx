'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SupplierDetailClient from '@/components/admin/suppliers/SupplierDetailClient'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import type { Supplier } from '@/types/admin.types'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function AdminSupplierDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [token, setToken]       = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    document.title = supplier ? `${supplier.supplier_name} | Tyres & Car Valeting` : 'Supplier | Tyres & Car Valeting'
  }, [supplier])

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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${res.status}`)
        }
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

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Suppliers', href: '/admin/suppliers' }, { label: 'Supplier' }]} />
        <p className="mt-6 text-sm text-zinc-500">Supplier not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Suppliers', href: '/admin/suppliers' },
          { label: supplier.supplier_name },
        ]} />
      </div>
      <SupplierDetailClient supplier={supplier} accessToken={token} />
    </div>
  )
}
