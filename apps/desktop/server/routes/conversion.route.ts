import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { createConversion, getConversion, getConversions, undoConversion } from '../controllers/conversion.controller.js'

const router = express.Router()

router.get('/conversions', isAuthenticated, getConversions)
router.get('/conversions/:id', isAuthenticated, getConversion)
router.post('/conversions', isAuthenticated, authorizeWrite, createConversion)
router.delete('/conversions/:id', isAuthenticated, authorizeDelete, undoConversion)

export default router
