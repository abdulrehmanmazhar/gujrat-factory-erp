import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { createCustomerKhata, createSupplierKhata, deleteKhata, getCustomerKhata, getSupplierKhata } from '../controllers/khata.controller.js'

const router = express.Router()

router.get('/khata/customers', isAuthenticated, getCustomerKhata)
router.get('/khata/suppliers', isAuthenticated, getSupplierKhata)
router.post('/khata/customers', isAuthenticated, authorizeWrite, createCustomerKhata)
router.post('/khata/suppliers', isAuthenticated, authorizeWrite, createSupplierKhata)
router.delete('/khata/:party/:id', isAuthenticated, authorizeDelete, deleteKhata)

export default router
