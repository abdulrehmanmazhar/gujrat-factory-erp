import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
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
router.post('/labourers', isAuthenticated, authorizeRoles('admin'), createLabourer)
router.put('/labourers/:id', isAuthenticated, authorizeRoles('admin'), updateLabourer)
router.post('/labourers/:id/rates', isAuthenticated, authorizeRoles('admin'), setLabourRate)
router.delete('/labourers/:id/rates/:productId', isAuthenticated, authorizeRoles('admin'), removeLabourRate)

router.get('/labour/production', isAuthenticated, getProductionEntries)
router.get('/labour/production/:id', isAuthenticated, getProductionEntry)
router.post('/labour/production', isAuthenticated, authorizeRoles('admin'), recordProduction)

router.get('/labour/transactions', isAuthenticated, getLabourTransactions)
router.post('/labour/transactions', isAuthenticated, authorizeRoles('admin'), createLabourTransaction)
router.delete('/labour/transactions/:id', isAuthenticated, authorizeRoles('admin'), deleteLabourTransaction)

export default router
