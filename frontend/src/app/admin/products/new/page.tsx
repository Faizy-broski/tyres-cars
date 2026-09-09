'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CreateProductForm from '@/components/admin/products/CreateProductForm'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Meta = {
  brands:      { brand_id: string; brand_name: string }[]
  collections: { collection_id: string; collection_name: string }[]
  categories:  { category_id: string; category_name: string; category_type: string }[]
  patterns:    { pattern_id: string; pattern_name: string; brand_id: string }[]
}

export default function NewProductPage() {
  const [meta, setMeta]           = useState<Meta>({ brands: [], collections: [], categories: [], patterns: [] })
  const [warehouses, setWarehouses] = useState<{ warehouse_id: string; warehouse_name: string }[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { document.title = 'New Product | Tyres & Car Valeting' }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        const headers = { Authorization: `Bearer ${tok}` }
        const [metaRes, whRes] = await Promise.all([
          fetch(`${API}/api/admin/products/meta`, { headers }),
          fetch(`${API}/api/admin/orders/warehouses`, { headers }),
        ])
        if (!metaRes.ok) {
          const body = await metaRes.json().catch(() => ({}))
          throw new Error(body.error ?? `Failed to load product metadata (${metaRes.status})`)
        }
        const metaData: Meta = await metaRes.json()
        const whData = whRes.ok ? await whRes.json().catch(() => []) : []
        if (!cancelled) {
          setMeta(metaData)
          setWarehouses(Array.isArray(whData) ? whData : [])
        }
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load form data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-zinc-400 animate-pulse">Loading product form…</div>
      </div>
    )
  }

  return (
    <CreateProductForm
      brands={meta.brands}
      collections={meta.collections}
      categories={meta.categories}
      warehouses={warehouses}
      patterns={meta.patterns}
    />
  )
}
