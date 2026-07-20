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

const whatsappWinston = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
            const stackStr = stack ? `\n${stack}` : ''
            return `${timestamp} [${level}] ${message}${metaStr}${stackStr}`
        })
    ),
    transports: [
        new winston.transports.File({ filename: path.join(logsDir, 'whatsapp.log') }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message }) => `[whatsapp] ${level}: ${message}`)
            )
        })
    ]
})

export const logger: ILogger = {
    info: (message: string, meta?: object) => winstonLogger.info(message, meta),
    error: (message: string, meta?: object) => winstonLogger.error(message, meta)
}

export const whatsappLogger: ILogger = {
    info: (message: string, meta?: object) => whatsappWinston.info(message, meta),
    error: (message: string, meta?: object) => whatsappWinston.error(message, meta)
}

export default winstonLogger
