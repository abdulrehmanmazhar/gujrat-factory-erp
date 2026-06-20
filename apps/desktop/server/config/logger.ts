import fs from 'fs'
import path from 'path'
import winston from 'winston'
import type { ILogger } from 'server-util'

const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
}

const winstonLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        }),
        new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logsDir, 'combined.log') })
    ]
})

export const logger: ILogger = {
    info: (message: string, meta?: object) => winstonLogger.info(message, meta),
    error: (message: string, meta?: object) => winstonLogger.error(message, meta)
}

export default winstonLogger
