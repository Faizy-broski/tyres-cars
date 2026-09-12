'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { OrderListItem, PaymentStatus, OrderStatus } from '@/types/admin.types'
import OrderFiltersBar from '@/components/admin/orders/OrderFiltersBar'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { TableBodySpinner } from '@/components/ui/table-loader'
import { Button } from '@/components/ui/button'
import {
  useOrderList, useOrderStats, useUpdateOrderStatus, useDeleteOrder,
  type OrderStats, type OrderListResponse,
} from '@/lib/query/hooks'
import { toastPromise, toastError } from '@/lib/toast'

// ── Badge helpers ──────────────────────────────────────────────────────────

const PAYMENT_DOT: Record<PaymentStatus, string>   = { paid: 'bg-green-500', unpaid: 'bg-amber-500', partially_paid: 'bg-blue-500', refunded: 'bg-zinc-400' }
const PAYMENT_LABEL: Record<PaymentStatus, string> = { paid: 'Paid', unpaid: 'Unpaid', partially_paid: 'Partial', refunded: 'Refunded' }
const ALL_PAYMENT_STATUSES: PaymentStatus[] = ['paid', 'unpaid', 'refunded']

function InlinePaymentSelect({ orderId, status }: { orderId: string; status: PaymentStatus }) {
  const { mutateAsync, isPending } = useUpdateOrderStatus()
  async function onChange(paymentStatus: string) {
    try {
      await toastPromise(mutateAsync({ orderId, paymentStatus }), {
        loading: 'Updating payment…',
        success: 'Payment status updated',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Update failed',
      })
    } catch { /* shown by toastPromise */ }
  }
  return (
    <div className="relative inline-flex">
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700 whitespace-nowrap">
        {isPending
          ? <span className="w-2 h-2 rounded-full border border-zinc-400 border-t-transparent animate-spin" />
          : <span className={`w-2 h-2 rounded-full ${PAYMENT_DOT[status] ?? PAYMENT_DOT.unpaid}`} />
        }
        {PAYMENT_LABEL[status] ?? status}
        <svg className="w-2.5 h-2.5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </span>
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={status}
        disabled={isPending}
        onChange={e => onChange(e.target.value)}
      >
        {ALL_PAYMENT_STATUSES.map(s => (
          <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>
        ))}
      </select>
    </div>
  )
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:    'bg-zinc-100 text-zinc-600 border-zinc-200',
  paid:       'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  fulfilled:  'bg-green-50 text-green-700 border-green-200',
  cancelled:  'bg-red-50 text-red-700 border-red-200',
  refunded:   'bg-zinc-100 text-zinc-600 border-zinc-200',
}
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending', paid: 'Paid', processing: 'Processing',
  fulfilled: 'Fulfilled', cancelled: 'Cancelled', refunded: 'Refunded',
}
const ALL_STATUSES: OrderStatus[] = ['pending', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded']

function InlineStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const { mutateAsync, isPending } = useUpdateOrderStatus()
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  async function onChange(fulfillmentStatus: string) {
    try {
      await toastPromise(mutateAsync({ orderId, fulfillmentStatus }), {
        loading: 'Updating status…',
        success: 'Order status updated',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Update failed',
      })
    } catch { /* shown by toastPromise */ }
  }
  return (
    <div className="relative inline-flex">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${style} ${isPending ? 'opacity-60' : ''}`}>
        {isPending && <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />}
        {STATUS_LABELS[status] ?? status}
        <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </span>
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={status}
        disabled={isPending}
        onChange={e => onChange(e.target.value)}
      >
        {ALL_STATUSES.map(s => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  )
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function addressSnippet(snap: Record<string, string> | null) {
  if (!snap) return '—'
  return [snap.address_line1, snap.city, snap.postal_code].filter(Boolean).join(', ') || '—'
}

function RowActionsDropdown({ orderId }: { orderId: string }) {
  const [open, setOpen]           = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [rect, setRect]           = useState<DOMRect | null>(null)
  const btnRef                    = useRef<HTMLButtonElement>(null)
  const dropRef                   = useRef<HTMLDivElement>(null)
  const { mutateAsync: deleteOrder, isPending: deleting } = useDeleteOrder()
  const router = useRouter()

  function toggle() {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
    setConfirming(false)
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      setOpen(false)
      setConfirming(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function handleDelete() {
    try {
      await toastPromise(deleteOrder(orderId), {
        loading: 'Deleting order…',
        success: 'Order deleted',
        error:   (err: unknown) => err instanceof Error ? err.message : 'Failed to delete order',
      })
      setOpen(false)
    } catch {
      // error shown by toastPromise
    }
  }

  const dropdown = open && rect ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'fixed', top: rect.bottom + 4, right: window.innerWidth - rect.right, zIndex: 9999 }}
      className="w-40 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl overflow-hidden"
    >
      <button
        onClick={() => { setOpen(false); router.push(`/admin/orders/${orderId}`) }}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        View Order
      </button>
      <div className="my-1 border-t border-zinc-100" />
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Delete Order
        </button>
      ) : (
        <div className="px-3.5 py-2.5 space-y-2">
          <p className="text-xs text-zinc-600 font-medium">Delete permanently?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={deleting}
              onClick={handleDelete}
              className="flex-1 rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
            >
              {deleting ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={toggle}
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
      >
        Actions
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {dropdown}
    </div>
  )
}

function KpiCard({ title, value, sub, icon, borderColor = "border-zinc-300" }: { title: string; value: string; sub: string; icon: React.ReactNode; borderColor?: string }) {
  return (
    <div className={`rounded-xl border ${borderColor} bg-white p-5 flex flex-col justify-between shadow-md`}>
      <div className="flex items-center justify-between mb-4 mt-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</p>
        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-500 shrink-0">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-zinc-900 tracking-tight leading-none mb-1.5">{value}</p>
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-500">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
          {sub}
        </div>
      </div>
    </div>
  )
}

const LIMIT = 20

const EMPTY_STATS: OrderStats = { totalOrders: 0, totalRevenue: 0, avgOrderSize: 0, pendingPayment: 0 }

type Props = {
  initialStats?:  OrderStats
  initialOrders?: OrderListResponse
}

export default function OrdersClient({ initialStats, initialOrders }: Props) {
  const searchParams    = useSearchParams()
  const router          = useRouter()
  const pathname        = usePathname()

  const search            = searchParams.get('search')            ?? ''
  const page              = Number(searchParams.get('page')        ?? 1)
  const paymentStatus     = searchParams.get('paymentStatus')     ?? ''
  const fulfillmentStatus = searchParams.get('fulfillmentStatus') ?? ''

  // Only use initialData for page 1 with no filters — that's what the SSR pre-fetched
  const isDefaultView = page === 1 && !search && !paymentStatus && !fulfillmentStatus

  const listQuery  = useOrderList(
    { search, page, paymentStatus, fulfillmentStatus },
    { initialData: isDefaultView ? initialOrders : undefined },
  )
  const statsQuery = useOrderStats({ initialData: initialStats })

  const loading = listQuery.isPending || statsQuery.isPending
  const orders  = listQuery.data?.data   ?? []
  const total   = listQuery.data?.total  ?? 0
  const stats   = statsQuery.data        ?? EMPTY_STATS

  const totalPages = Math.ceil(total / LIMIT)

  function buildHref(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    const merged = { search, paymentStatus, fulfillmentStatus, page: String(page), ...overrides }
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v) })
    return `${pathname}?${p}`
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <AdminBreadcrumb crumbs={[{ label: 'Orders' }]} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="h-4 w-28 bg-zinc-100 rounded animate-pulse mb-3" />
                <div className="h-7 w-24 bg-zinc-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-zinc-100 rounded animate-pulse" />
              </div>
            ))}
          </>
        ) : (
          <>
            <KpiCard
              title="Total Orders"
              value={stats.totalOrders.toLocaleString()}
              sub="All time"
              borderColor="border-primary"
              icon={
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <KpiCard
              title="Total Revenue"
              value={fmtMoney(stats.totalRevenue)}
              sub="Paid orders"
              borderColor="border-emerald-400"
              icon={
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <KpiCard
              title="Average Order Size"
              value={fmtMoney(stats.avgOrderSize)}
              sub="Per order"
              borderColor="border-blue-400"
              icon={
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              }
            />
            <KpiCard
              title="Pending Payment"
              value={stats.pendingPayment.toLocaleString()}
              sub="Orders awaiting payment"
              borderColor="border-amber-400"
              icon={
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Orders table */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900">Orders</h2>
          <div className="flex flex-wrap items-center gap-2">
            <OrderFiltersBar
              search={search}
              paymentStatus={paymentStatus}
              fulfillmentStatus={fulfillmentStatus}
            />
            <form className="flex items-center gap-2" onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const p  = new URLSearchParams(searchParams.toString())
              const s  = fd.get('search') as string
              if (s) p.set('search', s); else p.delete('search')
              p.set('page', '1')
              router.push(`${pathname}?${p}`)
            }}>
              {paymentStatus     && <input type="hidden" name="paymentStatus"     value={paymentStatus} />}
              {fulfillmentStatus && <input type="hidden" name="fulfillmentStatus" value={fulfillmentStatus} />}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  name="search"
                  defaultValue={search}
                  placeholder="Search"
                  className="pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
                />
              </div>
              <Button type="submit" variant="outline" size="icon-sm" aria-label="Apply filters">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </Button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-primary/10">
                {['Order #', 'Created ↓', 'Customer', 'Address', 'Payment', 'Fulfillment', 'Items', 'Order Total', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-zinc-800 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <TableBodySpinner />
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 mx-auto">
                      <svg className="w-10 h-10 text-zinc-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                      </svg>
                      <p className="text-sm font-medium text-zinc-400">{search ? `No orders matching "${search}"` : 'No orders yet.'}</p>
                      {search && <p className="text-xs text-zinc-300">Try adjusting your search or filters.</p>}
                    </div>
                  </td>
                </tr>
              ) : orders.map(o => {
                const customerName = o.customers
                  ? [o.customers.first_name, o.customers.last_name].filter(Boolean).join(' ') || o.customers.email
                  : '—'
                return (
                  <tr key={o.order_id} className="odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.order_id}`} className="font-bold text-primary hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700">
                      <div className="flex flex-col">
                        <span>
                          {new Date(o.created_at).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                        <span className="text-zinc-500">
                          {new Date(o.created_at).toLocaleTimeString('en-AU', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.customers ? (
                        <Link href={`/admin/customers/${o.customers.customer_id}`} className="font-bold text-primary hover:underline text-xs">
                          {customerName}
                        </Link>
                      ) : <span className="text-zinc-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700 max-w-40 truncate">
                      {addressSnippet(o.shipping_address_snapshot)}
                    </td>
                    <td className="px-4 py-3">
                      <InlinePaymentSelect orderId={o.order_id} status={o.payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <InlineStatusSelect orderId={o.order_id} status={o.order_status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-800 text-center font-medium">
                      {o.order_items?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                      {fmtMoney(Number(o.total_amount))}
                    </td>
                    <td className="px-4 py-3">
                      <RowActionsDropdown orderId={o.order_id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <span>
            {total === 0 ? '0 results' : `${Math.min((page - 1) * LIMIT + 1, total)} — ${Math.min(page * LIMIT, total)} of ${total} results`}
          </span>
          <div className="flex items-center gap-3">
            <span>{page} of {totalPages || 1} pages</span>
            <div className="flex gap-1">
              {page > 1 ? (
                <Link href={buildHref({ page: String(page - 1) })} className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium">Prev</Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-300 cursor-not-allowed text-xs">Prev</span>
              )}
              {page < totalPages ? (
                <Link href={buildHref({ page: String(page + 1) })} className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-white hover:border-zinc-400 transition-colors text-xs font-medium">Next</Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-300 cursor-not-allowed text-xs">Next</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
