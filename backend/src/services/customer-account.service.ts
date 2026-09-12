import { supabase as db } from './supabase.service'

const PAGE_SIZE = 20

// ── Profile ──────────────────────────────────────────────────────────────────

// Registration only creates an auth user + profile row — no customers row.
// Lazily create one here on first access so a brand-new signup can
// immediately see their (empty) order history / account page instead of
// hitting "Customer not found".
export async function getCustomerByProfileId(profileId: string) {
  const existing = await db
    .from('customers')
    .select('customer_id, email, first_name, last_name, phone, created_at')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing.data) return { data: existing.data, error: null }
  if (existing.error) return existing

  const { data: authUser, error: authErr } = await db.auth.admin.getUserById(profileId)
  if (authErr || !authUser?.user?.email) {
    return { data: null, error: authErr ?? new Error('Auth user not found') }
  }

  const meta = authUser.user.user_metadata as { first_name?: string; last_name?: string }
  const { data: created, error: createErr } = await db
    .from('customers')
    .upsert(
      {
        profile_id: profileId,
        email:      authUser.user.email,
        first_name: meta?.first_name ?? null,
        last_name:  meta?.last_name  ?? null,
      },
      { onConflict: 'email' }
    )
    .select('customer_id, email, first_name, last_name, phone, created_at')
    .single()

  if (createErr) return { data: null, error: createErr }
  return { data: created, error: null }
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function listCustomerOrders(customerId: string, page = 1) {
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  return db
    .from('orders')
    .select(`
      order_id, order_number, created_at, total_amount,
      payment_status, order_status,
      order_items ( order_item_id )
    `, { count: 'exact' })
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(from, to)
}

export async function getCustomerOrder(customerId: string, orderId: string) {
  const { data, error } = await db
    .from('orders')
    .select(`
      order_id, order_number, created_at, currency, notes,
      gst_amount, discount_amount, total_amount,
      payment_status, order_status,
      shipping_address_snapshot,
      order_items (
        order_item_id, product_id, quantity, unit_price,
        skus ( sku, tyre_size_display )
      ),
      order_payments (
        payment_id, payment_method, amount, currency, status, created_at
      ),
      order_activity (
        activity_id, event_type, description, created_at
      )
    `)
    .eq('order_id', orderId)
    .eq('customer_id', customerId)
    .order('created_at', { referencedTable: 'order_activity', ascending: true })
    .single()

  return { data, error }
}

// ── Profile update ────────────────────────────────────────────────────────────

export async function updateCustomerProfile(
  customerId: string,
  patch: { first_name?: string; last_name?: string; phone?: string },
) {
  return db
    .from('customers')
    .update({
      first_name: patch.first_name,
      last_name:  patch.last_name,
      phone:      patch.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId)
    .select('customer_id, email, first_name, last_name, phone')
    .single()
}

// ── Addresses ─────────────────────────────────────────────────────────────────

export async function listCustomerAddresses(customerId: string) {
  return db
    .from('addresses')
    .select('address_id, address_name, address_line1, address_line2, city, state, postal_code, country, phone')
    .eq('customer_id', customerId)
    .order('address_name')
}

export async function addCustomerAddress(
  customerId: string,
  payload: {
    address_name:  string
    address_line1: string
    address_line2?: string
    city?:         string
    state?:        string
    postal_code?:  string
    country?:      string
    phone?:        string
  },
) {
  return db
    .from('addresses')
    .insert({ customer_id: customerId, ...payload })
    .select('address_id, address_name, address_line1, address_line2, city, state, postal_code, country, phone')
    .single()
}

export async function deleteCustomerAddress(customerId: string, addressId: string) {
  return db
    .from('addresses')
    .delete()
    .eq('address_id', addressId)
    .eq('customer_id', customerId)
}
