import express from 'express'
import { authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { createUnit, getUnits } from '../controllers/unit.controller.js'

const router = express.Router()

router.get('/units', isAuthenticated, getUnits)
router.post('/units', isAuthenticated, authorizeWrite, createUnit)

export default router
