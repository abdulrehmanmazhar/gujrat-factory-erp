import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { normalizeDocumentLanguage } from '../utils/documentI18n.js'
import { readAppSettings, writeAppSettings } from '../utils/appSettings.js'

export const getSettings = CatchAsyncError(async (_req: Request, res: Response) => {
    const settings = readAppSettings()
    httpResponse(_req, res, 200, 'Settings fetched successfully', { settings })
})

export const updateSettings = CatchAsyncError(async (req: Request, res: Response) => {
    const { documentLanguage } = req.body as { documentLanguage?: string }
    if (!documentLanguage) throw new AppError('documentLanguage is required', 400)

    const settings = {
        documentLanguage: normalizeDocumentLanguage(documentLanguage)
    }
    writeAppSettings(settings)
    httpResponse(req, res, 200, 'Settings updated successfully', { settings })
})
