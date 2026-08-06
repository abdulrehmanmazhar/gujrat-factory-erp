import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    createSupplier,
    deactivateSupplier,
    getSupplier,
    getSuppliers,
    linkSupplierProduct,
    linkSupplierProductsByCategories,
    unlinkSupplierProduct,
    updateSupplier
} from '../controllers/supplier.controller.js'

const router = express.Router()

router.post('/suppliers', isAuthenticated, authorizeWrite, createSupplier)
router.get('/suppliers', isAuthenticated, getSuppliers)
router.get('/suppliers/:id', isAuthenticated, getSupplier)
router.put('/suppliers/:id', isAuthenticated, authorizeWrite, updateSupplier)
router.delete('/suppliers/:id', isAuthenticated, authorizeDelete, deactivateSupplier)
router.post('/suppliers/:id/products/by-categories', isAuthenticated, authorizeWrite, linkSupplierProductsByCategories)
router.post('/suppliers/:id/products', isAuthenticated, authorizeWrite, linkSupplierProduct)
router.delete('/suppliers/:id/products/:productId', isAuthenticated, authorizeDelete, unlinkSupplierProduct)

export default router
