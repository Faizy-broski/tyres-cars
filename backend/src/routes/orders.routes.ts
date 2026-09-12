import { Router } from 'express'
import { createOrder } from '../services/orders.service'

const router = Router()

// POST /api/orders
// Creates an order after Stripe payment succeeds on the storefront.
router.post('/', async (req, res, next) => {
  try {
    const {
      customer,
      items,
      shipping_address,
      stripe_payment_intent_id,
      total_amount,
    } = req.body

    if (!customer?.email || !items?.length || !shipping_address || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const { data, error } = await createOrder({
      customer,
      items,
      shipping_address,
      stripe_payment_intent_id: stripe_payment_intent_id ?? null,
      total_amount,
    })

    if (error) {
      if ((error as any).code === 'PRODUCT_NOT_FOUND') {
        return res.status(422).json({ error: error.message })
      }
      return next(error)
    }
    res.status(201).json(data)
  } catch (err) { next(err) }
})

export default router
