import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { getSales } from '../controllers/transaction.controller.js'

const router = express.Router()

router.post('/get-sales', isAuthenticated, authorizeRoles('admin'), getSales)

export default router
