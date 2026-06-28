import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { getRecentTransactions, getSales } from '../controllers/transaction.controller.js'
import { exportAnalyticsExcel, getHomeAnalytics } from '../controllers/analytics.controller.js'

const router = express.Router()

router.post('/get-sales', isAuthenticated, authorizeRoles('admin'), getSales)
router.get('/recent-transactions', isAuthenticated, getRecentTransactions)
router.get('/analytics/home', isAuthenticated, getHomeAnalytics)
router.get('/analytics/export', isAuthenticated, authorizeRoles('admin'), exportAnalyticsExcel)

export default router
