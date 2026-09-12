/**
 * Structured query key factory for all admin data.
 * Keys follow the hierarchy: [domain, entity, operation, params]
 * This lets us invalidate at any level (e.g. all orders, or just a specific list page).
 */
export const adminKeys = {
  // Orders
  orderStats:    ()                           => ['admin', 'orders', 'stats']                as const,
  orderList:     (p: Record<string, string>)  => ['admin', 'orders', 'list', p]             as const,
  orderDetail:   (id: string)                 => ['admin', 'orders', 'detail', id]          as const,

  // Customers
  customerStats: ()                           => ['admin', 'customers', 'stats']            as const,
  customerList:  (p: Record<string, string>)  => ['admin', 'customers', 'list', p]         as const,
  customerDetail:(id: string)                 => ['admin', 'customers', 'detail', id]      as const,

  // Products
  productMeta:   ()                           => ['admin', 'products', 'meta']             as const,
  productList:   (p: Record<string, string>)  => ['admin', 'products', 'list', p]          as const,
  productDetail: (id: string)                 => ['admin', 'products', 'detail', id]       as const,
  productCategories: ()                       => ['admin', 'products', 'categories']       as const,
  productCollections: ()                      => ['admin', 'products', 'collections']      as const,

  // Brands / Patterns
  brandList:     (p?: Record<string, string>) => p ? ['admin', 'brands',   'list', p] as const : ['admin', 'brands',   'list'] as const,
  patternList:   (p?: Record<string, string>) => p ? ['admin', 'patterns', 'list', p] as const : ['admin', 'patterns', 'list'] as const,
  brandListAll:  ()                           => ['admin', 'brands', 'all']              as const,
}

export const customerKeys = {
  me:          ()                          => ['customer', 'me']                    as const,
  orderList:   (p: Record<string, string>) => ['customer', 'orders', 'list', p]    as const,
  orderDetail: (id: string)                => ['customer', 'orders', 'detail', id] as const,
  addresses:   ()                          => ['customer', 'addresses']             as const,
}

