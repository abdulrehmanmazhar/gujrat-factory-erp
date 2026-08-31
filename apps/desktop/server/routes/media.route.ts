import express from 'express'
import { isAuthenticated } from '../middleware/auth.js'
import { downloadMedia, listMedia } from '../controllers/media.controller.js'

const router = express.Router()

router.get('/media', isAuthenticated, listMedia)
router.get('/media/file', isAuthenticated, downloadMedia)

export default router
