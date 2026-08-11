import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    createMiscExpenditure,
    createMiscExpenditureCategory,
    deleteMiscExpenditure,
    getMiscExpenditureCategories,
    getMiscExpenditures
} from '../controllers/miscExpenditure.controller.js'

const router = express.Router()

router.get('/miscellaneous-expenditure-categories', isAuthenticated, getMiscExpenditureCategories)
router.post('/miscellaneous-expenditure-categories', isAuthenticated, authorizeWrite, createMiscExpenditureCategory)
router.get('/miscellaneous-expenditures', isAuthenticated, getMiscExpenditures)
router.post('/miscellaneous-expenditures', isAuthenticated, authorizeWrite, createMiscExpenditure)
router.delete('/miscellaneous-expenditures/:id', isAuthenticated, authorizeDelete, deleteMiscExpenditure)

export default router
