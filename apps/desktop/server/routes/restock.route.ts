import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    addRestockOrderItem,
    cancelRestockOrder,
    createRestockOrder,
    deleteRestockOrder,
    getRestockOrder,
    getRestockOrders,
    getSupplierTransactions,
    markRestockOrdered,
    receiveRestockOrder,
    recordRestockPayment,
    recordRestockRefund
} from '../controllers/restock.controller.js'

const router = express.Router()

router.post('/restock-orders', isAuthenticated, authorizeWrite, createRestockOrder)
router.get('/restock-orders', isAuthenticated, getRestockOrders)
router.get('/restock-orders/:id', isAuthenticated, getRestockOrder)
router.post('/restock-orders/:id/items', isAuthenticated, authorizeWrite, addRestockOrderItem)
router.post('/restock-orders/:id/order', isAuthenticated, authorizeWrite, markRestockOrdered)
router.post('/restock-orders/:id/receive', isAuthenticated, authorizeWrite, receiveRestockOrder)
router.post('/restock-orders/:id/payments', isAuthenticated, authorizeWrite, recordRestockPayment)
router.post('/restock-orders/:id/refunds', isAuthenticated, authorizeWrite, recordRestockRefund)
router.post('/restock-orders/:id/cancel', isAuthenticated, authorizeWrite, cancelRestockOrder)
router.delete('/restock-orders/:id', isAuthenticated, authorizeDelete, deleteRestockOrder)

router.get('/supplier/transactions', isAuthenticated, getSupplierTransactions)

export default router
