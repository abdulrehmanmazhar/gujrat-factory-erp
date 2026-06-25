import express from 'express'
import { downloadBackup, restoreBackup } from '../controllers/backup.controller.js'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'

const router = express.Router()

router.get('/backup', isAuthenticated, authorizeRoles('super_admin'), downloadBackup)
router.post('/backup/restore', isAuthenticated, authorizeRoles('super_admin'), restoreBackup)

export default router
