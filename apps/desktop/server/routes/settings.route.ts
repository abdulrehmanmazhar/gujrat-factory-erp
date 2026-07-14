import express from 'express'
import { authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { getSettings, updateSettings } from '../controllers/settings.controller.js'

const router = express.Router()

router.get('/settings', isAuthenticated, getSettings)
router.put('/settings', isAuthenticated, authorizeWrite, updateSettings)

export default router
