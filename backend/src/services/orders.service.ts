import { supabase as db } from './supabase.service'
import { redis, TTL } from './redis.service'
import { insertNotifications, getAdminUserIds } from './notifications.service'

const _statsCache = { entry: null as { data: Record<string, number>; exp: number } | null }

const PAGE_SIZE = 20

// ── Stats ───────────────────────────────────────────────────────────────────

export async function getOrderStats() {
  const cacheKey = 'admin:order-stats'

  // Redis first, then process-local fallback (TTL.ADMIN_KPI = 300s)
  const redisCached = await redis?.get<Record<string, number>>(cacheKey)
  if (redisCached) return redisCached
  if (_statsCache.entry && _statsCache.entry.exp > Date.now()) return _statsCache.entry.data

  const { data, error } = await db.rpc('get_order_stats')
  if (error) throw error
  const d = data as any
  const stats = {
    totalOrders:    Number(d?.totalOrders   ?? 0),
    totalRevenue:   Number(d?.totalRevenue  ?? 0),
    avgOrderSize:   Number(d?.avgOrderSize  ?? 0),
    pendingPayment: Number(d?.pendingPayment ?? 0),
  }
  await redis?.set(cacheKey, stats, { ex: TTL.ADMIN_KPI })
  _statsCache.entry = { data: stats, exp: Date.now() + TTL.ADMIN_KPI * 1000 }
  return stats
}

// ── List ────────────────────────────────────────────────────────────────────

export async function listOrders(opts: {
  search?:            string
  paymentStatus?:     string
  fulfillmentStatus?: string
  page?:              number
}) {
  const { search = '', paymentStatus, fulfillmentStatus, page = 1 } = opts
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let query = db
    .from('orders')
    .select(`
      order_id, order_number, created_at, currency,
      payment_status, order_status, total_amount,
      shipping_address_snapshot,
      customers ( customer_id, first_name, last_name, email ),
      order_items ( order_item_id )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (paymentStatus)     query = query.eq('payment_status', paymentStatus)
  if (fulfillmentStatus) query = query.eq('order_status', fulfillmentStatus)
  if (search) {
    // Search by order number — ilike across join columns is complex; filter order_number
    query = query.ilike('order_number', `%${search}%`)
  }

  const { data, error, count } = await query
  return { data: data ?? [], error, count }
}

// ── Get single order ────────────────────────────────────────────────────────

export async function getOrder(orderId: string) {
  const { data, error } = await db
    .from('orders')
    .select(`
      order_id, order_number, created_at, currency, notes,
      gst_amount, discount_amount, total_amount,
      payment_status, order_status,
      shipping_address_snapshot, billing_address_snapshot,
      customers (
        customer_id, email, first_name, last_name, phone, created_at, profile_id
      ),
      order_items (
        order_item_id, product_id, quantity, unit_price,
        skus ( sku, tyre_size_display )
      ),
      order_payments (
        payment_id, payment_reference, payment_method, amount, currency, status, created_at
      ),
      order_activity (
        activity_id, event_type, description, amount, currency, created_at
      )
    `)
    .eq('order_id', orderId)
    .order('created_at', { referencedTable: 'order_activity', ascending: false })
    .single()

  return { data, error }
}

// ── Update order status ─────────────────────────────────────────────────────

export async function updateOrderStatus(orderId: string, patch: {
  paymentStatus?:     string
  fulfillmentStatus?: string
  notes?:             string | null
}) {
  const update: Record<string, any> = {}
  if (patch.paymentStatus)        update.payment_status = patch.paymentStatus
  if (patch.fulfillmentStatus)    update.order_status   = patch.fulfillmentStatus
  if (patch.notes !== undefined)  update.notes          = patch.notes

  if (Object.keys(update).length === 0) return { error: null }

  const { error } = await db.from('orders').update(update).eq('order_id', orderId)

  if (!error) {
    await db.from('order_activity').insert({
      order_id:    orderId,
      event_type:  'status_updated',
      description: 'Order status updated by admin',
    })
  }

  return { error }
}

// ── Delete order ────────────────────────────────────────────────────────────

export async function deleteOrder(orderId: string) {
  const { error } = await db.from('orders').delete().eq('order_id', orderId)
  return { error }
}

// ── Create order (storefront checkout) ──────────────────────────────────────

export interface CreateOrderPayload {
  customer: { email: string; first_name: string; last_name: string; phone?: string }
  items: Array<{ product_id: string; quantity: number; unit_price: number }>
  shipping_address: { line1: string; line2?: string; suburb: string; state: string; postcode: string }
  stripe_payment_intent_id: string
  total_amount: number                   // authoritative — set by backend via PaymentIntent
}

export async function createOrder(payload: CreateOrderPayload) {
  // 1. Find or create guest customer
  let customerId: string
  const { data: existing } = await db
    .from('customers')
    .select('customer_id')
    .eq('email', payload.customer.email)
    .maybeSingle()

  if (existing) {
    customerId = existing.customer_id
    // Keep phone up to date if customer provided one and we don't have it yet
    if (payload.customer.phone) {
      await db.from('customers')
        .update({ phone: payload.customer.phone })
        .eq('customer_id', customerId)
        .is('phone', null)
    }
  } else {
    const { data: newCust, error: custErr } = await db
      .from('customers')
      .insert({
        email:      payload.customer.email,
        first_name: payload.customer.first_name,
        last_name:  payload.customer.last_name,
        phone:      payload.customer.phone ?? null,
      })
      .select('customer_id')
      .single()
    if (custErr || !newCust) return { data: null, error: custErr ?? new Error('Failed to create customer') }
    customerId = newCust.customer_id
  }

  // 2. Validate all product_ids exist in skus (catches stale carts after SKU deletion)
  const requestedIds = payload.items.map(i => i.product_id)
  const { data: foundSkus } = await db
    .from('skus')
    .select('product_id')
    .in('product_id', requestedIds)

  const foundIds = new Set((foundSkus ?? []).map((s: { product_id: string }) => s.product_id))
  const missing  = requestedIds.filter(id => !foundIds.has(id))
  if (missing.length > 0) {
    return {
      data:  null,
      error: Object.assign(new Error('One or more products in your cart are no longer available. Please refresh and try again.'), { code: 'PRODUCT_NOT_FOUND', missing }),
    }
  }

  // 3. Generate order number TVT-YYYYMMDD-XXXX
  const datePart  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand      = String(Math.floor(Math.random() * 9000) + 1000)
  const orderNumber = `TVT-${datePart}-${rand}`

  // 4. Insert order
  const { data: order, error: orderErr } = await db
    .from('orders')
    .insert({
      order_number:              orderNumber,
      customer_id:               customerId,
      payment_status:            'paid',
      order_status:              'processing',
      currency:                  'AUD',
      total_amount:              payload.total_amount,
      gst_amount:                0,
      discount_amount:           0,
      shipping_address_snapshot: payload.shipping_address,
    })
    .select('order_id, order_number')
    .single()

  if (orderErr || !order) return { data: null, error: orderErr ?? new Error('Failed to create order') }

  // 5. Insert order items
  const { error: itemsErr } = await db.from('order_items').insert(
    payload.items.map(i => ({
      order_id:    order.order_id,
      product_id:  i.product_id,
      quantity:    i.quantity,
      unit_price:  i.unit_price,
      total_price: +(i.unit_price * i.quantity).toFixed(2),
    }))
  )
  if (itemsErr) return { data: null, error: itemsErr }

  // 6. Decrement stock — single batch UPDATE instead of N+1 read-modify-write loop
  await db.rpc('decrement_stock_batch', {
    p_items: payload.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
  })

  // 7. Payment record
  await db.from('order_payments').insert({
    order_id:          order.order_id,
    payment_reference: orderNumber,
    payment_method:    'stripe',
    amount:            payload.total_amount,
    currency:          'AUD',
    status:            'paid',
    stripe_payment_id: payload.stripe_payment_intent_id,
  })

  // 8. Activity log
  await db.from('order_activity').insert({
    order_id:    order.order_id,
    event_type:  'order_placed',
    description: `Order ${orderNumber} placed via storefront checkout`,
  })

  // 9. In-app notifications → all admins (fire-and-forget)
  const customerFull = `${payload.customer.first_name} ${payload.customer.last_name}`.trim()
  getAdminUserIds().then(adminIds =>
    insertNotifications(adminIds.map(id => ({
      recipient_id: id,
      type:         'new_order',
      title:        `New order ${orderNumber}`,
      body:         `${customerFull} · A$${payload.total_amount.toFixed(2)}`,
      metadata:     { order_id: order.order_id, order_number: orderNumber },
    })))
  ).catch(() => {})

  return { data: { order_id: order.order_id, order_number: order.order_number }, error: null }
}
