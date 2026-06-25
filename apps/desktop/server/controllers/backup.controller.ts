import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { createBackupArchive, createRestoreUploadDir, stageRestoreArchive } from '../services/backup.service.js'

const restoreUploadDir = createRestoreUploadDir()

const restoreUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, restoreUploadDir),
        filename: (_req, file, cb) => cb(null, `restore-${Date.now()}${path.extname(file.originalname) || '.bak'}`)
    }),
    limits: { fileSize: 1024 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith('.bak')) cb(null, true)
        else cb(new Error('Only .bak backup files are allowed'))
    }
})

export const downloadBackup = CatchAsyncError(async (_req: Request, res: Response) => {
    const { buffer, fileName } = await createBackupArchive()

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', buffer.length)
    res.status(200).send(buffer)
})

export const restoreBackup = [
    restoreUpload.single('backup'),
    CatchAsyncError(async (req: Request, res: Response) => {
        if (!req.file) throw new AppError('Backup file is required', 400)

        try {
            const result = await stageRestoreArchive(req.file.path)
            httpResponse(req, res, 200, 'Backup staged successfully. Restart the application to complete restore.', result)
        } finally {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        }
    })
]
