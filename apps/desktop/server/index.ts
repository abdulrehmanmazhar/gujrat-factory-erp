import 'dotenv/config'
import http from 'node:http'
import { Server } from 'socket.io'
import { app } from './app.js'
import { appConfig } from './config/env.js'
import { logger } from './config/logger.js'
import { connectDB } from './utils/db.js'
import { runScheduler } from './services/order.service.js'
import { connectWhatsapp, getLatestQr, isWhatsappConnected } from './utils/whatsapp.js'

const server = http.createServer(app)

const io = new Server(server, {
    cors: { origin: '*' }
})

io.on('connection', (socket) => {
    logger.info('Frontend connected to WebSocket')
    if (getLatestQr()) socket.emit('qr', getLatestQr())
    socket.emit('whatsapp:status', { connected: isWhatsappConnected() })
})

connectWhatsapp(io)

async function bootstrap() {
    await connectDB()
    runScheduler()

    server.listen(appConfig.PORT, () => {
        logger.info(`Server running on port ${appConfig.PORT}`)
    })
}

bootstrap()
