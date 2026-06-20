import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import {
    createSupplier,
    deactivateSupplier,
    getSupplier,
    getSuppliers,
    linkSupplierProduct,
    unlinkSupplierProduct,
    updateSupplier
} from '../controllers/supplier.controller.js'

const router = express.Router()

router.post('/suppliers', isAuthenticated, authorizeRoles('admin'), createSupplier)
router.get('/suppliers', isAuthenticated, getSuppliers)
router.get('/suppliers/:id', isAuthenticated, getSupplier)
router.put('/suppliers/:id', isAuthenticated, authorizeRoles('admin'), updateSupplier)
router.delete('/suppliers/:id', isAuthenticated, authorizeRoles('admin'), deactivateSupplier)
router.post('/suppliers/:id/products', isAuthenticated, authorizeRoles('admin'), linkSupplierProduct)
router.delete('/suppliers/:id/products/:productId', isAuthenticated, authorizeRoles('admin'), unlinkSupplierProduct)

export default router
