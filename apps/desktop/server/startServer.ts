import http from 'node:http'
import { Server } from 'socket.io'
import { app } from './app.js'
import { appConfig } from './config/env.js'
import { logger } from './config/logger.js'
import { connectDB } from './utils/db.js'
import { runScheduler } from './services/order.service.js'
import { connectWhatsapp, getLatestQr, isWhatsappConnected } from './utils/whatsapp.js'
import { setIo } from './utils/socket.js'
import { broadcastWhatsAppQueueStats, getWhatsAppQueueStats } from './utils/whatsappQueue.js'

const server = http.createServer(app)

const io = new Server(server, {
    cors: { origin: '*' }
})

setIo(io)

io.on('connection', async (socket) => {
    logger.info('Frontend connected to WebSocket')
    if (getLatestQr()) socket.emit('qr', getLatestQr())
    socket.emit('whatsapp:status', { connected: isWhatsappConnected() })
    try {
        const stats = await getWhatsAppQueueStats()
        socket.emit('whatsapp:queue:update', stats)
    } catch (error) {
        logger.error('Failed to send initial WhatsApp queue stats', { meta: { error } })
    }
})

connectWhatsapp(io)

export async function startServer() {
    await connectDB()
    runScheduler()

    await new Promise<void>((resolve, reject) => {
        server.once('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
                reject(
                    new Error(
                        `Port ${appConfig.PORT} is already in use. Stop the other server instance (desktop app or another terminal) and try again.`
                    )
                )
                return
            }
            reject(error)
        })

        server.listen(appConfig.PORT, () => {
            server.removeAllListeners('error')
            logger.info(`Server running on port ${appConfig.PORT}`)
            resolve()
        })
    })
}
