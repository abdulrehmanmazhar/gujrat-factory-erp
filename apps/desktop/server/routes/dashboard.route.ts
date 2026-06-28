import express from 'express'
import { isAuthenticated } from '../middleware/auth.js'
import { getStockVsPending, getUpcomingDeliveries, postponeDelivery } from '../controllers/dashboard.controller.js'

const router = express.Router()

router.get('/dashboard/upcoming-deliveries', isAuthenticated, getUpcomingDeliveries)
router.get('/dashboard/stock-vs-pending', isAuthenticated, getStockVsPending)
router.put('/orders/:id/postpone-delivery', isAuthenticated, postponeDelivery)

export default router
