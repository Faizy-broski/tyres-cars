import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import * as ctrl from '../controllers/admin.customers.controller'

const router = Router()
router.use(authMiddleware, requireRole('super_admin'))

// ── Customers ──────────────────────────────────────────────────────────────
router.get('/stats',                                ctrl.getCustomerStats)
router.get('/',                                     ctrl.getCustomers)
router.post('/',                                    ctrl.postCustomer)
router.get('/:id',                                  ctrl.getCustomer)
router.patch('/:id',                                ctrl.patchCustomer)
router.delete('/:id',                               ctrl.removeCustomer)

// ── Addresses ──────────────────────────────────────────────────────────────
router.post('/:id/addresses',                       ctrl.postAddress)
router.delete('/:id/addresses/:addressId',          ctrl.removeAddress)

export default router
