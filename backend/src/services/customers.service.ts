import { supabase as supabaseAdmin } from './supabase.service'

const PAGE_SIZE = 20

// ── Customers ──────────────────────────────────────────────────────────────

export async function getCustomerStats() {
  const { data, error } = await supabaseAdmin.rpc('get_customer_stats')
  if (error) throw error
  const d = data as any
  return {
    totalCustomers: Number(d?.totalCustomers ?? 0),
    totalOrders:    Number(d?.totalOrders    ?? 0),
    avgOrderSize:   Number(d?.avgOrderSize   ?? 0),
    totalRevenue:   Number(d?.totalRevenue   ?? 0),
  }
}

export async function listCustomers(opts: {
  search?: string
  accountType?: 'guest' | 'registered'
  page?: number
}) {
  const { search = '', accountType, page = 1 } = opts
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let query = supabaseAdmin
    .from('customers')
    .select('customer_id, email, first_name, last_name, phone, created_at, profile_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search)       query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  if (accountType === 'guest')      query = query.is('profile_id', null)
  if (accountType === 'registered') query = query.not('profile_id', 'is', null)

  const { data, error, count } = await query

  if (error || !data?.length) {
    return { data: data ?? [], error, count }
  }

  const customerIds = data.map(customer => customer.customer_id)
  const { data: orderRows, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('customer_id, total_amount, order_number, created_at')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false })
    .limit(200)

  if (ordersError || !orderRows?.length) {
    return { data, error: ordersError, count }
  }

  const orderSummaryByCustomer = new Map<string, {
    order_count: number
    total_spent: number
    last_order_number: string | null
    last_order_date: string | null
  }>()

  for (const row of orderRows) {
    const customerId = row.customer_id as string
    const existing = orderSummaryByCustomer.get(customerId) ?? {
      order_count: 0,
      total_spent: 0,
      last_order_number: null,
      last_order_date: null,
    }

    existing.order_count += 1
    existing.total_spent += Number(row.total_amount ?? 0)

    if (!existing.last_order_number) {
      existing.last_order_number = row.order_number ?? null
      existing.last_order_date = row.created_at ?? null
    }

    orderSummaryByCustomer.set(customerId, existing)
  }

  const enriched = data.map(customer => ({
    ...customer,
    ...(orderSummaryByCustomer.get(customer.customer_id) ?? {
      order_count: 0,
      total_spent: 0,
      last_order_number: null,
      last_order_date: null,
    }),
  }))

  return { data: enriched, error: null, count }
}

export async function getCustomer(customerId: string) {
  const supabase = supabaseAdmin

  const [customerRes, ordersRes, addressesRes] = await Promise.all([
    supabase
      .from('customers')
      .select('customer_id, email, first_name, last_name, phone, created_at, profile_id')
      .eq('customer_id', customerId)
      .single(),

    supabase
      .from('orders')
      .select(`
        order_id, order_number, created_at,
        payment_status, order_status, total_amount,
        order_items ( product_id )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),

    supabase
      .from('addresses')
      .select('address_id, address_name, address_line1, address_line_1, address_line2, address_line_2, city, suburb, state, postal_code, postcode, country, company, phone, is_default, owner_type, owner_id')
      .eq('owner_type', 'customer')
      .eq('owner_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  if (customerRes.error || !customerRes.data) return { data: null, error: customerRes.error }

  const orders = (ordersRes.data ?? []).map((o: any) => ({
    ...o,
    item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
  }))

  return {
    data: {
      ...customerRes.data,
      orders,
      addresses: addressesRes.data ?? [],
    },
    error: null,
  }
}

export async function createCustomer(payload: {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
}) {
  return supabaseAdmin.from('customers').insert({
    email:      payload.email,
    first_name: payload.firstName ?? null,
    last_name:  payload.lastName  ?? null,
    phone:      payload.phone     ?? null,
    profile_id: null,
  }).select('customer_id').single()
}

export async function updateCustomer(customerId: string, patch: {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
}) {
  return supabaseAdmin.from('customers').update({
    ...(patch.email     !== undefined && { email:      patch.email }),
    ...(patch.firstName !== undefined && { first_name: patch.firstName }),
    ...(patch.lastName  !== undefined && { last_name:  patch.lastName }),
    ...(patch.phone     !== undefined && { phone:      patch.phone }),
  }).eq('customer_id', customerId)
}

export async function deleteCustomer(customerId: string) {
  return supabaseAdmin.from('customers').delete().eq('customer_id', customerId)
}

// ── Addresses ──────────────────────────────────────────────────────────────

export async function createAddress(customerId: string, payload: {
  addressName: string
  addressLine1: string
  addressLine2?: string
  suburb?: string       // spec name (preferred)
  city?: string         // old name fallback
  postcode?: string     // spec name (preferred)
  postalCode?: string   // old name fallback
  country?: string
  state?: string
  company?: string
  phone?: string
  isDefault?: boolean
}) {
  const suburb   = payload.suburb    ?? payload.city       ?? null
  const postcode = payload.postcode  ?? payload.postalCode ?? null
  return supabaseAdmin.from('addresses').insert({
    // Polymorphic owner fields
    owner_type:     'customer',
    owner_id:       customerId,
    // Legacy customer_id kept for backward compat
    customer_id:    customerId,
    address_name:   payload.addressName,
    // Old column names (backward compat)
    address_line1:  payload.addressLine1,
    address_line2:  payload.addressLine2 ?? null,
    city:           suburb,
    postal_code:    postcode,
    // Spec column names
    address_line_1: payload.addressLine1,
    address_line_2: payload.addressLine2 ?? null,
    suburb,
    postcode,
    country:        payload.country   ?? 'Australia',
    state:          payload.state     ?? null,
    company:        payload.company   ?? null,
    phone:          payload.phone     ?? null,
    is_default:     payload.isDefault ?? false,
  }).select('address_id').single()
}

export async function deleteAddress(customerId: string, addressId: string) {
  return supabaseAdmin.from('addresses').delete()
    .eq('address_id', addressId)
    .eq('owner_type', 'customer')
    .eq('owner_id', customerId)
}
