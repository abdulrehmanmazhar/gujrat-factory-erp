import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { getProductSales } from '../controllers/productSale.controller.js'
const router = express.Router()

router.post('/get-product-sales', isAuthenticated, getProductSales)
export default router
