'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { OrderDetail } from '@/types/admin.types'
import OrderDetailClient from '@/components/admin/orders/OrderDetailClient'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()

  const [order, setOrder]     = useState<OrderDetail | null>(null)
  const [token, setToken]     = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = order ? `Order ${order.order_number} | Tyres & Car Valeting` : 'Order | Tyres & Car Valeting'
  }, [order])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const accessToken = session?.access_token ?? ''
        if (!cancelled) setToken(accessToken)

        const res = await fetch(`${API}/api/admin/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${res.status}`)
        }

        const data: OrderDetail = await res.json()
        if (!cancelled) setOrder(data)
      } catch (err: unknown) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load order')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [orderId])

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-zinc-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Order' }]} />
        <p className="mt-6 text-sm text-zinc-500">Order not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Orders', href: '/admin/orders' },
          { label: order.order_number },
        ]} />
      </div>
      <OrderDetailClient order={order} accessToken={token} />
    </div>
  )
}
