import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { createTransaction, deleteTransaction, getTodayTransactions, getTransactions } from '../controllers/transaction.controller.js'
const router = express.Router()

router.post('/create-transaction', isAuthenticated, authorizeWrite, createTransaction)
router.delete('/delete-transaction/:id', isAuthenticated, authorizeDelete, deleteTransaction)
router.get('/get-transactions', isAuthenticated, getTransactions)
router.get('/get-today-transactions', isAuthenticated, getTodayTransactions)

export default router
