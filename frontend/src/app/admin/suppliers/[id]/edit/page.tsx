'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SupplierFormClient from '@/components/admin/suppliers/SupplierFormClient'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { toastError } from '@/lib/toast'
import type { Supplier } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function EditSupplierPage() {
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${res.status}`)
        }
        const data: Supplier = await res.json()
        if (!cancelled) {
          setSupplier(data)
          document.title = `Edit ${data.supplier_name} | Tyres & Car Valeting`
        }
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load supplier')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return (
    <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
      <div className="h-6 w-48 bg-zinc-100 rounded animate-pulse" />
      <div className="h-64 bg-zinc-100 rounded-2xl animate-pulse" />
    </div>
  )

  if (!supplier) return (
    <div className="p-4 sm:p-6">
      <AdminBreadcrumb crumbs={[{ label: 'Suppliers', href: '/admin/suppliers' }, { label: 'Edit' }]} />
      <p className="mt-6 text-sm text-zinc-500">Supplier not found.</p>
    </div>
  )

  return <SupplierFormClient supplier={supplier} accessToken={token} />
}
