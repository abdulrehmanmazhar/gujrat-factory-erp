import fs from 'node:fs'
import { Router } from 'express'
import { resolveStoredFilePath } from '../utils/rcloneSetup.js'

const router = Router()

router.get('*', (req, res) => {
    const relativePath = req.path.replace(/^\//, '')
    if (!relativePath) {
        res.status(404).end()
        return
    }

    try {
        const absPath = resolveStoredFilePath(relativePath)
        if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
            res.status(404).end()
            return
        }

        res.sendFile(absPath)
    } catch {
        res.status(404).end()
    }
})

export default router
