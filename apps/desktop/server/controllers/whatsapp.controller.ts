import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { getIo } from '../utils/socket.js'
import { isWhatsappConnected, logoutWhatsapp } from '../utils/whatsapp.js'
import {
    getWhatsAppQueueStats,
    listWhatsAppQueue,
    retryFailedWhatsAppQueueItems,
    retryWhatsAppQueueItem
} from '../utils/whatsappQueue.js'
import { param } from '../utils/params.js'

export const getQueueStatus = CatchAsyncError(async (_req: Request, res: Response) => {
    const stats = await getWhatsAppQueueStats()
    httpResponse(_req, res, 200, 'WhatsApp queue status fetched', {
        connected: isWhatsappConnected(),
        ...stats
    })
})

export const listQueue = CatchAsyncError(async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const page = req.query.page ? Number(req.query.page) : undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const result = await listWhatsAppQueue({ status, page, limit })
    httpResponse(req, res, 200, 'WhatsApp queue listed', result)
})

export const retryQueueItem = CatchAsyncError(async (req: Request, res: Response) => {
    const id = param(req.params.id)
    const result = await retryWhatsAppQueueItem(id)
    httpResponse(req, res, 200, 'Queue item queued for retry', result)
})

export const retryFailedQueue = CatchAsyncError(async (req: Request, res: Response) => {
    const result = await retryFailedWhatsAppQueueItems()
    httpResponse(req, res, 200, 'Failed queue items queued for retry', result)
})

export const logout = CatchAsyncError(async (req: Request, res: Response) => {
    const io = getIo()
    if (!io) throw new AppError('Socket server not initialized', 500)
    await logoutWhatsapp(io)
    httpResponse(req, res, 200, 'WhatsApp logged out. Scan QR to link again.', { connected: false })
})
