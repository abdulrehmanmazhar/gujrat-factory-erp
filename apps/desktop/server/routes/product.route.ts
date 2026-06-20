import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { addProduct, deleteProduct, editProduct, getProductStockHistory, getProducts, restockProduct } from '../controllers/product.controller.js'

const router = express.Router()

router.post('/add-product', isAuthenticated, addProduct)
router.put('/restock-product/:id', isAuthenticated, restockProduct)
router.put('/edit-product/:id', isAuthenticated, editProduct)
router.get('/get-products', isAuthenticated, getProducts)
router.get('/product-stock-history/:id', isAuthenticated, getProductStockHistory)
router.delete('/delete-product/:id', isAuthenticated, authorizeRoles('admin'), deleteProduct)

export default router
