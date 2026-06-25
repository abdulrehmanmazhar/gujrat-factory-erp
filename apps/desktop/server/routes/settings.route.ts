import express from 'express'
import { getSettings, updateSettings } from '../controllers/settings.controller.js'
import { isAuthenticated } from '../middleware/auth.js'

const router = express.Router()

router.get('/settings', isAuthenticated, getSettings)
router.put('/settings', isAuthenticated, updateSettings)

export default router
