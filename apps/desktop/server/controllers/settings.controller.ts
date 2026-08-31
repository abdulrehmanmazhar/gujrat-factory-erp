import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { normalizeDocumentLanguage } from '../utils/documentI18n.js'
import {
    normalizePosBannerHeight,
    readAppSettings,
    writeAppSettings
} from '../utils/appSettings.js'
import { deleteRemoteFile, uploadFile } from '../utils/rclone.js'
import { moduleDir } from '../utils/esm.js'

const brandingUploadDir = path.join(moduleDir(import.meta.url), '../uploads/branding')
if (!fs.existsSync(brandingUploadDir)) fs.mkdirSync(brandingUploadDir, { recursive: true })

const posBannerUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, brandingUploadDir),
        filename: (_req, file, cb) =>
            cb(null, `pos-banner-${Date.now()}${path.extname(file.originalname) || '.jpg'}`)
    }),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true)
        else cb(new Error('Only image files are allowed'))
    }
})

export const getSettings = CatchAsyncError(async (_req: Request, res: Response) => {
    const settings = readAppSettings()
    httpResponse(_req, res, 200, 'Settings fetched successfully', { settings })
})

export const updateSettings = CatchAsyncError(async (req: Request, res: Response) => {
    const { documentLanguage, posBannerHeightPx } = req.body as {
        documentLanguage?: string
        posBannerHeightPx?: number
    }

    if (documentLanguage === undefined && posBannerHeightPx === undefined) {
        throw new AppError('No settings to update', 400)
    }

    const current = readAppSettings()
    const settings = {
        ...current,
        ...(documentLanguage !== undefined
            ? { documentLanguage: normalizeDocumentLanguage(documentLanguage) }
            : {}),
        ...(posBannerHeightPx !== undefined
            ? { posBannerHeightPx: normalizePosBannerHeight(posBannerHeightPx) }
            : {})
    }
    writeAppSettings(settings)
    httpResponse(req, res, 200, 'Settings updated successfully', { settings })
})

export const uploadPosBanner = [
    posBannerUpload.single('banner'),
    CatchAsyncError(async (req: Request, res: Response) => {
        if (!req.file) throw new AppError('Banner image is required', 400)

        const current = readAppSettings()
        const ext = path.extname(req.file.originalname) || path.extname(req.file.filename) || '.jpg'
        const relativePath = `branding/pos-banner${ext}`
        const uploaded = await uploadFile(req.file.path, relativePath, req)
        fs.unlinkSync(req.file.path)

        if (current.posBannerPublicId) {
            await deleteRemoteFile(current.posBannerPublicId)
        }

        const settings = {
            ...current,
            posBannerUrl: uploaded.url ?? uploaded.remotePath,
            posBannerPublicId: uploaded.remotePath
        }
        writeAppSettings(settings)
        httpResponse(req, res, 200, 'POS banner updated successfully', { settings })
    })
]

export const removePosBanner = CatchAsyncError(async (req: Request, res: Response) => {
    const current = readAppSettings()

    if (current.posBannerPublicId) {
        await deleteRemoteFile(current.posBannerPublicId)
    }

    const settings = {
        ...current,
        posBannerUrl: null,
        posBannerPublicId: null
    }
    writeAppSettings(settings)
    httpResponse(req, res, 200, 'POS banner removed successfully', { settings })
})
