import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { getIo } from '../utils/socket.js'
import { isWhatsappConnected, logoutWhatsapp } from '../utils/whatsapp.js'
import { getWhatsAppQueueStats } from '../utils/whatsappQueue.js'

export const getQueueStatus = CatchAsyncError(async (_req: Request, res: Response) => {
    const stats = await getWhatsAppQueueStats()
    httpResponse(_req, res, 200, 'WhatsApp queue status fetched', {
        connected: isWhatsappConnected(),
        ...stats
    })
})

export const logout = CatchAsyncError(async (req: Request, res: Response) => {
    const io = getIo()
    if (!io) throw new AppError('Socket server not initialized', 500)
    await logoutWhatsapp(io)
    httpResponse(req, res, 200, 'WhatsApp logged out. Scan QR to link again.', { connected: false })
})
