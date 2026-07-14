import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    createLabourer,
    createLabourTransaction,
    deleteLabourTransaction,
    getLabourer,
    getLabourers,
    getLabourTransactions,
    getProductionEntries,
    getProductionEntry,
    recordProduction,
    removeLabourRate,
    setLabourRate,
    updateLabourer
} from '../controllers/labour.controller.js'

const router = express.Router()

router.get('/labourers', isAuthenticated, getLabourers)
router.get('/labourers/:id', isAuthenticated, getLabourer)
router.post('/labourers', isAuthenticated, authorizeWrite, createLabourer)
router.put('/labourers/:id', isAuthenticated, authorizeWrite, updateLabourer)
router.post('/labourers/:id/rates', isAuthenticated, authorizeWrite, setLabourRate)
router.delete('/labourers/:id/rates/:productId', isAuthenticated, authorizeDelete, removeLabourRate)

router.get('/labour/production', isAuthenticated, getProductionEntries)
router.get('/labour/production/:id', isAuthenticated, getProductionEntry)
router.post('/labour/production', isAuthenticated, authorizeWrite, recordProduction)

router.get('/labour/transactions', isAuthenticated, getLabourTransactions)
router.post('/labour/transactions', isAuthenticated, authorizeWrite, createLabourTransaction)
router.delete('/labour/transactions/:id', isAuthenticated, authorizeDelete, deleteLabourTransaction)

export default router
