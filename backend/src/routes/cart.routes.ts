import { Router } from 'express'
import { supabase as db } from '../services/supabase.service'

const router = Router()

// POST /api/cart/validate
// Checks available_stock per SKU with a single aggregate query.
// No auth required — stock is public information.
router.post('/validate', async (req, res, next) => {
  try {
    const items: { sku_id: string; qty: number }[] = req.body.items ?? []
    if (!items.length) return res.json({ valid: true, errors: [] })

    const skuIds = items.map(i => i.sku_id)

    // Read the denormalized total_available_stock from skus (kept in sync with product_stock by trigger)
    const { data, error } = await db
      .from('skus')
      .select('product_id, total_available_stock')
      .in('product_id', skuIds)

    if (error) return next(error)

    const stockMap = new Map<string, number>()
    for (const row of (data ?? [])) {
      stockMap.set(row.product_id, row.total_available_stock ?? 0)
    }

    const errors: { sku_id: string; available: number }[] = []
    for (const item of items) {
      const available = stockMap.get(item.sku_id) ?? 0
      if (item.qty > available) {
        errors.push({ sku_id: item.sku_id, available })
      }
    }

    res.json({ valid: errors.length === 0, errors })
  } catch (err) { next(err) }
})

// POST /api/cart/prices
// Returns the live server-side retail price per product_id (never trust client-supplied prices).
// Body: { items: [{ product_id }] }
router.post('/prices', async (req, res, next) => {
  try {
    const items: { product_id: string }[] = req.body.items ?? []
    if (!items.length) return res.json({ prices: {} })

    const productIds = items.map(i => i.product_id)
    const { data, error } = await db
      .from('skus')
      .select('product_id, product_prices(price_type, price_inc_gst, is_active)')
      .in('product_id', productIds)

    if (error) return next(error)

    const prices: Record<string, number> = {}
    for (const sku of (data ?? []) as { product_id: string; product_prices: { price_type: string; price_inc_gst: number; is_active: boolean }[] }[]) {
      const retail = (sku.product_prices ?? []).find(p => p.is_active && p.price_type === 'retail')
      if (retail) prices[sku.product_id] = Number(retail.price_inc_gst)
    }

    res.json({ prices })
  } catch (err) { next(err) }
})

export default router
