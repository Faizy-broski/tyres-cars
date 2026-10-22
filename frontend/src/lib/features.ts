/**
 * Site-wide feature switches.
 *
 * ECOMMERCE_ENABLED — the whole tyre shop: tyre listing/product pages, tyre
 * search, deals & best sellers, cart, checkout, customer accounts/orders and
 * the admin Orders section. While false the site is a simple booking site —
 * customers fill in the booking form (/book, or the home page section) and the
 * request is emailed to the business (see app/api/booking/route.ts).
 * The shop routes redirect to /book (see proxy.ts). Flip to true to restore.
 */
export const ECOMMERCE_ENABLED = false

/** Route prefixes that only exist for e-commerce; redirected while it's off. */
export const ECOMMERCE_ROUTES = ['/tyres', '/cart', '/checkout', '/account', '/register', '/admin/orders']
