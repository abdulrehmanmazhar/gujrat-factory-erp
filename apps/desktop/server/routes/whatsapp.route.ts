import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { getQueueStatus, logout } from '../controllers/whatsapp.controller.js'

const router = express.Router()

router.get('/whatsapp/status', isAuthenticated, getQueueStatus)
router.post('/whatsapp/logout', isAuthenticated, authorizeRoles('admin'), logout)

export default router
