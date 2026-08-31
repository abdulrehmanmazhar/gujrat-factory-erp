import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { getRecentTransactions, getSales } from '../controllers/transaction.controller.js'
import {
    exportAnalyticsExcel,
    exportBusinessDataExcel,
    exportCustomerBalanceSheet,
    exportLabourBalanceSheet,
    exportSupplierBalanceSheet,
    getCustomerAnalytics,
    getCustomerAnalyticsDetail,
    getHomeAnalytics,
    getInventoryCustomerAnalytics,
    getInventoryLabourAnalytics,
    getInventorySupplierAnalytics,
    getLabourAnalytics,
    getLabourAnalyticsDetail,
    getSupplierAnalytics,
    getSupplierAnalyticsDetail
} from '../controllers/analytics.controller.js'

const router = express.Router()

router.post('/get-sales', isAuthenticated, authorizeRoles('admin'), getSales)
router.get('/recent-transactions', isAuthenticated, getRecentTransactions)
router.get('/analytics/home', isAuthenticated, getHomeAnalytics)
router.get('/analytics/customers', isAuthenticated, getCustomerAnalytics)
router.get('/analytics/customers/:id', isAuthenticated, getCustomerAnalyticsDetail)
router.get('/analytics/customers/:id/balance-sheet', isAuthenticated, exportCustomerBalanceSheet)
router.get('/analytics/suppliers', isAuthenticated, getSupplierAnalytics)
router.get('/analytics/suppliers/:id', isAuthenticated, getSupplierAnalyticsDetail)
router.get('/analytics/suppliers/:id/balance-sheet', isAuthenticated, exportSupplierBalanceSheet)
router.get('/analytics/labourers', isAuthenticated, getLabourAnalytics)
router.get('/analytics/labourers/:id', isAuthenticated, getLabourAnalyticsDetail)
router.get('/analytics/labourers/:id/balance-sheet', isAuthenticated, exportLabourBalanceSheet)
router.get('/analytics/inventory/customers', isAuthenticated, getInventoryCustomerAnalytics)
router.get('/analytics/inventory/suppliers', isAuthenticated, getInventorySupplierAnalytics)
router.get('/analytics/inventory/labourers', isAuthenticated, getInventoryLabourAnalytics)
router.get('/analytics/export', isAuthenticated, authorizeRoles('admin'), exportAnalyticsExcel)
router.get('/analytics/export/business-data', isAuthenticated, authorizeRoles('super_admin'), exportBusinessDataExcel)

export default router
