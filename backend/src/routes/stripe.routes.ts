import { Router } from 'express'
import Stripe from 'stripe'
import { supabase as db } from '../services/supabase.service'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// ── POST /api/stripe/payment-intent ───────────────────────────────────────────
// Server-side price authority — never trusts client-supplied total.
router.post('/payment-intent', async (req, res, next) => {
  try {
    const { items, order_ref } = req.body as {
      items:      { product_id: string; quantity: number }[]
      order_ref?: string
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'items required' })
    }

    // 1. Fetch live prices (promotion-aware) for each SKU
    const productIds = items.map(i => i.product_id)
    const { data: skus } = await db
      .from('skus')
      .select('product_id, product_prices(price_type, price_inc_gst, is_active)')
      .in('product_id', productIds)

    const priceMap: Record<string, number> = {}
    for (const sku of (skus ?? []) as { product_id: string; product_prices: { price_type: string; price_inc_gst: number; is_active: boolean }[] }[]) {
      const prices = (sku.product_prices ?? []).filter(p => p.is_active)
      const retail = prices.find(p => p.price_type === 'retail')
      if (retail) priceMap[sku.product_id] = Number(retail.price_inc_gst)
    }

    // 2. Items subtotal
    let itemsTotal = 0
    for (const item of items) {
      const price = priceMap[item.product_id] ?? 0
      itemsTotal += price * item.quantity
    }

    const totalCents = Math.round(itemsTotal * 100)

    if (totalCents < 50) {
      return res.status(400).json({ error: 'Order total too low — minimum A$0.50' })
    }

    const intent = await stripe.paymentIntents.create({
      amount:   totalCents,
      currency: 'aud',
      automatic_payment_methods: { enabled: true },
      metadata: { order_ref: order_ref ?? '' },
    })

    res.json({
      clientSecret:    intent.client_secret,
      calculatedTotal: itemsTotal,
      itemsTotal,
    })
  } catch (err) { next(err) }
})

export default router
