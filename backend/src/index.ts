import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { errorMiddleware } from './middleware/error.middleware'

const app = express()
const PORT = process.env.PORT || 3001

// EC2 is behind nginx/ALB — trust the first proxy hop so that
// express-rate-limit reads the real client IP from X-Forwarded-For
// instead of throwing a ValidationError and crashing the process.
app.set('trust proxy', 1)

// --- Security & compression ---
app.use(helmet())
app.use(compression())
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) return cb(null, true)
    // Strip trailing slash/dot for comparison
    const clean = origin.replace(/[./]+$/, '')
    if (ALLOWED_ORIGINS.some(o => o.replace(/[./]+$/, '') === clean)) {
      return cb(null, origin)  // Echo the exact origin back — avoids duplicate-header conflicts with nginx
    }
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true }))

// --- Rate limiting ---
const importLimiter = rateLimit({ windowMs: 60_000, max: 5,  standardHeaders: true, legacyHeaders: false })
const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false })

// --- Performance audit middleware (remove after profiling confirms fixes) ---
app.use((req, res, next) => {
  const start = process.hrtime.bigint()
  const originalJson = res.json.bind(res)
  let payloadBytes = 0

  res.json = (body: unknown) => {
    const serialized = JSON.stringify(body)
    payloadBytes = Buffer.byteLength(serialized, 'utf8')
    return originalJson(body)
  }

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000
    if (ms > 200) {
      console.warn(
        `[SLOW] ${req.method} ${req.originalUrl} → ${res.statusCode} | ${ms.toFixed(1)}ms | ${(payloadBytes / 1024).toFixed(1)}KB`
      )
    }
  })

  next()
})

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// --- Routes ---
import adminProductsRoutes      from './routes/admin.products.routes'
import adminCustomersRoutes     from './routes/admin.customers.routes'
import adminOrdersRoutes        from './routes/admin.orders.routes'
import storefrontProductsRoutes from './routes/storefront.products.routes'
import cartRoutes               from './routes/cart.routes'
import stripeRoutes             from './routes/stripe.routes'
import ordersRoutes             from './routes/orders.routes'
import customerAccountRoutes    from './routes/customer-account.routes'
app.use('/api/admin/products',          adminProductsRoutes)
app.use('/api/admin/customers',         adminCustomersRoutes)
app.use('/api/admin/orders',            adminOrdersRoutes)
app.use('/api/products',               storefrontProductsRoutes)
app.use('/api/cart',                   cartRoutes)
app.use('/api/stripe',                 stripeRoutes)
app.use('/api/orders',                 ordersRoutes)
app.use('/api/customer',               customerAccountRoutes)

// --- Error handler (must be last) ---
app.use(errorMiddleware)

app.listen(PORT, () => {
  console.log(`Onyx backend running on port ${PORT}`)
})

export default app
