import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { supabase as db } from '../services/supabase.service'
import { notificationQueue } from '../queues'

const router = Router()

const trackingLimiter = rateLimit({
  windowMs:       60_000,
  max:            5,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'Too many requests — please wait a moment and try again.' },
})

const priceMatchLimiter = rateLimit({
  windowMs:       60_000,
  max:            5,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'Too many requests — please wait a moment and try again.' },
})

router.post('/track', trackingLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order_number, email } = req.body as { order_number?: string; email?: string }

    if (!order_number || !email) {
      return res.status(400).json({ error: 'order_number and email are required' })
    }

    const { data, error } = await db.rpc('lookup_guest_order', {
      p_order_number: order_number,
      p_email:        email,
    })

    if (error) return next(error)

    // rpc returns an array; empty = not found or email mismatch
    const row = Array.isArray(data) ? data[0] : null
    if (!row) return res.status(404).json({ error: 'Order not found' })

    res.json(row)
  } catch (err) { next(err) }
})

router.post('/price-match', priceMatchLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name, email, phone, message,
      product_id, sku, product_name, tyre_size_display, price, product_url,
    } = req.body as {
      name?: string; email?: string; phone?: string; message?: string
      product_id?: string; sku?: string; product_name?: string; tyre_size_display?: string; price?: number; product_url?: string
    }

    if (!name || !email || !message || !product_id) {
      return res.status(400).json({ error: 'name, email, message and product_id are required' })
    }

    notificationQueue?.add('price_match_request', {
      type:              'price_match_request',
      customer_name:     name,
      customer_email:    email,
      customer_phone:    phone,
      message,
      product_id,
      sku:               sku ?? '',
      product_name,
      tyre_size_display,
      price,
      product_url,
    }).catch(() => {})

    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
