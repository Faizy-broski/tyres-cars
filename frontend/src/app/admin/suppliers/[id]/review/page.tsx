'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MappingReviewClient from '@/components/admin/suppliers/MappingReviewClient'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import type { SupplierMapping, Supplier } from '@/types/admin.types'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function MappingReviewPage() {
  const { id } = useParams<{ id: string }>()

  const [supplier, setSupplier]   = useState<Supplier | null>(null)
  const [mappings, setMappings]   = useState<SupplierMapping[]>([])
  const [total, setTotal]         = useState(0)
  const [token, setToken]         = useState('')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    document.title = supplier ? `${supplier.supplier_name} — Mapping Review | Tyres & Car Valeting` : 'Mapping Review | Tyres & Car Valeting'
  }, [supplier])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        if (!cancelled) setToken(tok)

        const headers = { Authorization: `Bearer ${tok}` }
        const [sRes, mRes] = await Promise.all([
          fetch(`${API}/api/admin/suppliers/${id}`, { headers }),
          fetch(`${API}/api/admin/suppliers/${id}/mappings?filter=pending&page=1`, { headers }),
        ])

        if (!sRes.ok) {
          const body = await sRes.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${sRes.status}`)
        }

        const sData = await sRes.json()
        if (!cancelled) setSupplier(sData)

        if (mRes.ok) {
          const mData = await mRes.json()
          if (!cancelled) {
            setMappings(mData.data ?? [])
            setTotal(mData.total ?? 0)
          }
        }
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load data')
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

  const supplierName = supplier?.supplier_name ?? id

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Suppliers', href: '/admin/suppliers' },
          { label: supplierName, href: `/admin/suppliers/${id}` },
          { label: 'Review' },
        ]} />
      </div>
      <MappingReviewClient
        supplierId={id}
        supplierName={supplierName}
        initialMappings={mappings}
        initialTotal={total}
        accessToken={token}
      />
    </div>
  )
}
