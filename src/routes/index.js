import { Router } from 'express'
import accountRoutes from '../modules/account/account.routes.js'
import adminRoutes from '../modules/admin/admin.routes.js'
import authRoutes from '../modules/auth/auth.routes.js'
import contactRoutes from '../modules/contact/contact.routes.js'
import fundingRoutes from '../modules/funding/funding.routes.js'
import healthRoutes from '../modules/health/health.routes.js'
import investmentsRoutes from '../modules/investments/investments.routes.js'
import plansRoutes from '../modules/plans/plans.routes.js'
import positionsRoutes from '../modules/positions/positions.routes.js'
import supportRoutes from '../modules/support/support.routes.js'
import transactionsRoutes from '../modules/transactions/transactions.routes.js'

const router = Router()

router.use('/health', healthRoutes)
router.use('/auth', authRoutes)
router.use('/plans', plansRoutes)
router.use('/positions', positionsRoutes)
router.use('/funding-methods', fundingRoutes)
router.use('/account', accountRoutes)
router.use('/investments', investmentsRoutes)
router.use('/transactions', transactionsRoutes)
router.use('/support', supportRoutes)
router.use('/contact', contactRoutes)
router.use('/admin', adminRoutes)

export default router
