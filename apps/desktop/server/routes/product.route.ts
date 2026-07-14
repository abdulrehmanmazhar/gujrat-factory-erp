import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { addProduct, deleteProduct, editProduct, getProductStockHistory, getProducts, restockProduct } from '../controllers/product.controller.js'

const router = express.Router()

router.post('/add-product', isAuthenticated, authorizeWrite, addProduct)
router.put('/restock-product/:id', isAuthenticated, authorizeWrite, restockProduct)
router.put('/edit-product/:id', isAuthenticated, authorizeWrite, editProduct)
router.get('/get-products', isAuthenticated, getProducts)
router.get('/product-stock-history/:id', isAuthenticated, getProductStockHistory)
router.delete('/delete-product/:id', isAuthenticated, authorizeDelete, deleteProduct)

export default router
