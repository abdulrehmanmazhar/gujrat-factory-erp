import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    createMiscExpenditure,
    createMiscExpenditureCategory,
    deleteMiscExpenditure,
    deleteMiscExpenditureCategory,
    getMiscExpenditureCategories,
    getMiscExpenditures,
    updateMiscExpenditureCategory
} from '../controllers/miscExpenditure.controller.js'

const router = express.Router()

router.get('/miscellaneous-expenditure-categories', isAuthenticated, getMiscExpenditureCategories)
router.post('/miscellaneous-expenditure-categories', isAuthenticated, authorizeWrite, createMiscExpenditureCategory)
router.put('/miscellaneous-expenditure-categories/:id', isAuthenticated, authorizeWrite, updateMiscExpenditureCategory)
router.delete('/miscellaneous-expenditure-categories/:id', isAuthenticated, authorizeDelete, deleteMiscExpenditureCategory)
router.get('/miscellaneous-expenditures', isAuthenticated, getMiscExpenditures)
router.post('/miscellaneous-expenditures', isAuthenticated, authorizeWrite, createMiscExpenditure)
router.delete('/miscellaneous-expenditures/:id', isAuthenticated, authorizeDelete, deleteMiscExpenditure)

export default router
