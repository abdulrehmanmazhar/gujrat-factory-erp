import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import {
    addRestockOrderItem,
    cancelRestockOrder,
    createRestockOrder,
    getRestockOrder,
    getRestockOrders,
    getSupplierTransactions,
    markRestockOrdered,
    receiveRestockOrder,
    recordRestockPayment,
    recordRestockRefund
} from '../controllers/restock.controller.js'

const router = express.Router()

router.post('/restock-orders', isAuthenticated, authorizeRoles('admin'), createRestockOrder)
router.get('/restock-orders', isAuthenticated, getRestockOrders)
router.get('/restock-orders/:id', isAuthenticated, getRestockOrder)
router.post('/restock-orders/:id/items', isAuthenticated, authorizeRoles('admin'), addRestockOrderItem)
router.post('/restock-orders/:id/order', isAuthenticated, authorizeRoles('admin'), markRestockOrdered)
router.post('/restock-orders/:id/receive', isAuthenticated, authorizeRoles('admin'), receiveRestockOrder)
router.post('/restock-orders/:id/payments', isAuthenticated, authorizeRoles('admin'), recordRestockPayment)
router.post('/restock-orders/:id/refunds', isAuthenticated, authorizeRoles('admin'), recordRestockRefund)
router.post('/restock-orders/:id/cancel', isAuthenticated, authorizeRoles('admin'), cancelRestockOrder)

router.get('/supplier/transactions', isAuthenticated, getSupplierTransactions)

export default router
