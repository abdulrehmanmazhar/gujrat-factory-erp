import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import {
    addOrder,
    addOrderPayment,
    cancelOrder,
    createCart,
    createOrder,
    deleteCart,
    generateInvoices,
    getAllOrders,
    getOrder,
    returnOrder,
    returnOrderUdhar
} from '../controllers/order.controller.js'
const router = express.Router()

router.post('/fill-cart/:id', isAuthenticated, createCart)
router.post('/create-order/:id', isAuthenticated, createOrder)
// router.put("/edit-cart/:id/:index",isAuthenticated,  editCart);
router.delete('/delete-cart/:id/:index', isAuthenticated, deleteCart)
router.post('/add-order/:id', isAuthenticated, addOrder)
router.post('/add-order-payment/:id', isAuthenticated, addOrderPayment)
router.post('/return-order/:id', isAuthenticated, returnOrder)
router.post('/return-order-udhar/:id', isAuthenticated, returnOrderUdhar)
router.post('/generate-invoices', isAuthenticated, generateInvoices)
router.post('/cancel-order/:id', isAuthenticated, authorizeRoles('admin'), cancelOrder)
router.get('/get-order/:id', isAuthenticated, getOrder)
router.get('/get-orders', isAuthenticated, getAllOrders)

export default router
