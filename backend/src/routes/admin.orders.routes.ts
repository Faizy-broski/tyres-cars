import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import * as ctrl from '../controllers/admin.orders.controller'

const router = Router()
router.use(authMiddleware, requireRole('super_admin'))

// Meta endpoints (must be before /:orderId to avoid param conflict)
router.get('/stats', ctrl.getOrderStats)

// Orders list + detail
router.get('/',                  ctrl.getOrders)
router.get('/:orderId',          ctrl.getOrder)
router.patch('/:orderId/status', ctrl.patchOrderStatus)
router.delete('/:orderId',       ctrl.deleteOrder)

export default router
