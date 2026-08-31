import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    addOrder,
    addOrderPayment,
    cancelOrder,
    createCart,
    createOrder,
    deleteCart,
    deleteOrder,
    generateInvoices,
    generateOrderSheet,
    getAllOrders,
    getOrder,
    recordOrderRefund,
    returnOrder,
    returnOrderUdhar
} from '../controllers/order.controller.js'
const router = express.Router()

router.post('/fill-cart/:id', isAuthenticated, authorizeWrite, createCart)
router.post('/create-order/:id', isAuthenticated, authorizeWrite, createOrder)
router.delete('/delete-cart/:id/:index', isAuthenticated, authorizeWrite, deleteCart)
router.post('/add-order/:id', isAuthenticated, authorizeWrite, addOrder)
router.post('/add-order-payment/:id', isAuthenticated, authorizeWrite, addOrderPayment)
router.post('/add-order-refund/:id', isAuthenticated, authorizeWrite, recordOrderRefund)
router.post('/return-order/:id', isAuthenticated, authorizeWrite, returnOrder)
router.post('/return-order-udhar/:id', isAuthenticated, authorizeWrite, returnOrderUdhar)
router.post('/generate-invoices', isAuthenticated, authorizeWrite, generateInvoices)
router.post('/generate-order-sheet', isAuthenticated, authorizeWrite, generateOrderSheet)
router.post('/cancel-order/:id', isAuthenticated, authorizeWrite, cancelOrder)
router.delete('/delete-order/:id', isAuthenticated, authorizeDelete, deleteOrder)
router.get('/get-order/:id', isAuthenticated, getOrder)
router.get('/get-orders', isAuthenticated, getAllOrders)

export default router
