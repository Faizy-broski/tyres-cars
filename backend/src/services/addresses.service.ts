import { supabase } from './supabase.service'

// Valid owner types per schema enum
export type AddressOwnerType = 'customer'

const ADDRESS_SELECT =
  'address_id, address_name, address_line1, address_line_1, address_line2, address_line_2, ' +
  'city, suburb, state, postal_code, postcode, country, company, phone, ' +
  'is_default, owner_type, owner_id, latitude, longitude'

// ============================================================
// LIST addresses by owner
// ============================================================
export async function getAddresses(ownerType: AddressOwnerType, ownerId: string) {
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_SELECT)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

// ============================================================
// CREATE address for any owner
// ============================================================
export async function createAddressForOwner(
  ownerType: AddressOwnerType,
  ownerId: string,
  payload: {
    addressName: string
    addressLine1: string
    addressLine2?: string
    suburb?: string
    state?: string
    postcode?: string
    country?: string
    latitude?: number | null
    longitude?: number | null
    isDefault?: boolean
  }
) {
  // If setting as default, clear existing defaults for this owner first
  if (payload.isDefault) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
  }

  const { data, error } = await supabase.from('addresses').insert({
    owner_type:     ownerType,
    owner_id:       ownerId,
    address_name:   payload.addressName,
    // Write both old + new spec column names
    address_line1:  payload.addressLine1,
    address_line_1: payload.addressLine1,
    address_line2:  payload.addressLine2 ?? null,
    address_line_2: payload.addressLine2 ?? null,
    suburb:         payload.suburb   ?? null,
    city:           payload.suburb   ?? null,      // old alias
    postcode:       payload.postcode ?? null,
    postal_code:    payload.postcode ?? null,      // old alias
    state:          payload.state    ?? null,
    country:        payload.country  ?? 'Australia',
    latitude:       payload.latitude  ?? null,
    longitude:      payload.longitude ?? null,
    is_default:     payload.isDefault ?? false,
  }).select('address_id').single()

  if (error) throw error
  return data
}

// ============================================================
// SET DEFAULT address
// ============================================================
export async function setDefaultAddress(
  ownerType: AddressOwnerType,
  ownerId: string,
  addressId: string
) {
  // Clear all defaults for this owner
  await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)

  // Set new default
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('address_id', addressId)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)

  if (error) throw error
}

// ============================================================
// DELETE address (verifies ownership)
// ============================================================
export async function deleteAddressById(
  addressId: string,
  ownerType: AddressOwnerType,
  ownerId: string
) {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('address_id', addressId)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)

  if (error) throw error
}
