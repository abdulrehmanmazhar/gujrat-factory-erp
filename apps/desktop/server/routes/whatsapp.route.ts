import express from 'express'
import { authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { getQueueStatus, listQueue, logout, retryFailedQueue, retryQueueItem } from '../controllers/whatsapp.controller.js'

const router = express.Router()

router.get('/whatsapp/status', isAuthenticated, getQueueStatus)
router.get('/whatsapp/queue', isAuthenticated, listQueue)
router.post('/whatsapp/queue/retry-failed', isAuthenticated, authorizeWrite, retryFailedQueue)
router.post('/whatsapp/queue/:id/retry', isAuthenticated, authorizeWrite, retryQueueItem)
router.post('/whatsapp/logout', isAuthenticated, authorizeWrite, logout)

export default router
