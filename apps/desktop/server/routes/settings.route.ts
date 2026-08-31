import express from 'express'
import { authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    getSettings,
    removePosBanner,
    updateSettings,
    uploadPosBanner
} from '../controllers/settings.controller.js'

const router = express.Router()

router.get('/settings', isAuthenticated, getSettings)
router.put('/settings', isAuthenticated, authorizeWrite, updateSettings)
router.post('/settings/pos-banner', isAuthenticated, authorizeWrite, uploadPosBanner)
router.delete('/settings/pos-banner', isAuthenticated, authorizeWrite, removePosBanner)

export default router
