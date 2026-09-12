'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CustomerDetailClient from '@/components/admin/customers/CustomerDetailClient'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { toastError } from '@/lib/toast'
import type {
  Address,
  CustomerDetail,
  CustomerListItem,
} from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type CustomerOrder = {
  order_id: string
  order_number: string
  created_at: string
  payment_status: string
  order_status: string
  total_amount: number
  item_count: number
  order_type: string | null
  payment_method?: string | null
}

export type OrderStats = {
  totalValue: number
  count: number
  avgOrderValue: number
  lastOrderDate: string | null
}

type PageState = {
  customer: CustomerListItem
  orders: CustomerOrder[]
  orderStats: OrderStats
  addresses: Address[]
  primaryAddress: Address | null
}

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()

  const [state, setState]     = useState<PageState | null>(null)
  const [token, setToken]     = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const c = state?.customer
    const name = c ? ([c.first_name, c.last_name].filter(Boolean).join(' ') || c.email) : null
    document.title = name ? `${name} | Tyres & Car Valeting` : 'Customer | Tyres & Car Valeting'
  }, [state])

  useEffect(() => {
    if (!customerId) return
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        if (!cancelled) setToken(tok)

        const res = await fetch(`${API}/api/admin/customers/${customerId}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${res.status}`)
        }
        const json = await res.json()
        const detail: CustomerDetail = json.customer

        const customer: CustomerListItem = {
          customer_id: detail.customer_id,
          email:       detail.email,
          first_name:  detail.first_name,
          last_name:   detail.last_name,
          phone:       detail.phone,
          created_at:  detail.created_at,
          profile_id:  detail.profile_id,
        }

        const orders: CustomerOrder[] = detail.orders.map(order => ({
          order_id: order.order_id,
          order_number: order.order_number,
          created_at: order.created_at,
          payment_status: order.payment_status,
          order_status: order.order_status,
          total_amount: Number(order.total_amount ?? 0),
          item_count: order.item_count ?? 0,
          order_type: order.order_type ?? null,
        }))

        const totalValue = orders.reduce((sum, o) => sum + o.total_amount, 0)
        const orderStats: OrderStats = {
          totalValue,
          count: orders.length,
          avgOrderValue: orders.length > 0 ? totalValue / orders.length : 0,
          lastOrderDate: orders[0]?.created_at ?? null,
        }

        const addresses = detail.addresses as Address[]

        if (!cancelled) setState({
          customer,
          orders,
          orderStats,
          addresses,
          primaryAddress: addresses[0] ?? null,
        })
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load customer')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [customerId, refreshKey])

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

  if (!state) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Customers', href: '/admin/customers' }, { label: 'Customer' }]} />
        <p className="mt-6 text-sm text-zinc-500">Customer not found.</p>
      </div>
    )
  }

  const customerName =
    [state.customer.first_name, state.customer.last_name].filter(Boolean).join(' ') ||
    state.customer.email

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Customers', href: '/admin/customers' },
          { label: customerName },
        ]} />
      </div>
      <CustomerDetailClient
        accessToken={token}
        customer={state.customer}
        orders={state.orders}
        orderStats={state.orderStats}
        addresses={state.addresses}
        primaryAddress={state.primaryAddress}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
    </div>
  )
}
