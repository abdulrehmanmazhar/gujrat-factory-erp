import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { getRecentTransactions, getSales } from '../controllers/transaction.controller.js'

const router = express.Router()

router.post('/get-sales', isAuthenticated, authorizeRoles('admin'), getSales)
router.get('/recent-transactions', isAuthenticated, getRecentTransactions)

export default router
