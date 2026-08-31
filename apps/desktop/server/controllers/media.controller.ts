import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { getMediaFile, listMediaCatalog, type MediaKindFilter } from '../services/media.service.js'

export const listMedia = CatchAsyncError(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined
    const kind = (typeof req.query.kind === 'string' ? req.query.kind : 'all') as MediaKindFilter
    const page = req.query.page ? Number(req.query.page) : undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const result = await listMediaCatalog({ q, kind, page, limit })
    httpResponse(req, res, 200, 'Media listed', result)
})

export const downloadMedia = CatchAsyncError(async (req: Request, res: Response) => {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id) throw new AppError('Media id is required', 400)
    const disposition = String(req.query.disposition ?? 'attachment') === 'inline' ? 'inline' : 'attachment'
    const file = await getMediaFile(id)
    const safeName = file.fileName.replace(/"/g, '')
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`)
    res.setHeader('Content-Length', String(file.buffer.length))
    res.send(file.buffer)
})
