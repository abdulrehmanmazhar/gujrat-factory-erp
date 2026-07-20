import fs from 'fs'
import type { Server as SocketServer } from 'socket.io'
import { DisconnectReason, fetchLatestBaileysVersion, makeWASocket, useMultiFileAuthState, type WASocket } from 'baileys'
import { whatsappLogger } from '../config/logger.js'
import { normalizeWhatsAppContact } from './phone.js'

export { normalizeWhatsAppContact as formatWhatsAppContact }

const AUTH_DIR = 'auth'
const RECONNECT_BASE_MS = 5_000
const RECONNECT_MAX_MS = 60_000
/** Used when fetchLatestBaileysVersion fails (offline / blocked). */
const FALLBACK_BAILEYS_VERSION: [number, number, number] = [2, 3000, 1015901307]

let sock: WASocket | undefined
let latestQr: string | null = null
let whatsappConnected = false
let ioRef: SocketServer | null = null
let connecting = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return { message: error.message, stack: error.stack, name: error.name }
    }
    return { message: String(error) }
}

function disconnectReasonLabel(code: number | undefined) {
    if (code === undefined) return 'unknown'
    const entry = Object.entries(DisconnectReason).find(([, value]) => value === code)
    return entry?.[0] ?? String(code)
}

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
}

function scheduleReconnect(reason: string) {
    if (reconnectTimer || !ioRef) return

    const delayMs = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS)
    reconnectAttempt += 1

    whatsappLogger.info('Scheduling WhatsApp reconnect', {
        meta: { reason, delayMs, attempt: reconnectAttempt }
    })

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void startWhatsappConnection(ioRef!)
    }, delayMs)
}

async function resolveBaileysVersion(): Promise<[number, number, number]> {
    try {
        const { version } = await fetchLatestBaileysVersion()
        whatsappLogger.info('Fetched latest Baileys version', { meta: { version } })
        return version
    } catch (error) {
        whatsappLogger.error('Could not fetch Baileys version — using fallback (likely offline)', {
            meta: { error: serializeError(error), fallback: FALLBACK_BAILEYS_VERSION }
        })
        return FALLBACK_BAILEYS_VERSION
    }
}

function teardownSocket() {
    if (!sock) return

    try {
        sock.end(undefined)
    } catch (error) {
        whatsappLogger.error('Error while closing WhatsApp socket', { meta: { error: serializeError(error) } })
    }

    sock = undefined
}

async function flushQueueSafely() {
    try {
        const { processWhatsAppQueue } = await import('./whatsappQueue.js')
        await processWhatsAppQueue()
    } catch (error) {
        whatsappLogger.error('WhatsApp queue flush failed', { meta: { error: serializeError(error) } })
    }
}

async function handleConnectionUpdate(
    io: SocketServer,
    update: { connection?: string; lastDisconnect?: { error?: { output?: { statusCode?: number } } }; qr?: string }
) {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
        latestQr = qr
        io.emit('qr', qr)
        whatsappLogger.info('WhatsApp QR code generated')
    }

    if (connection === 'close') {
        whatsappConnected = false
        latestQr = null
        io.emit('whatsapp:disconnected')

        const reasonCode = lastDisconnect?.error?.output?.statusCode
        whatsappLogger.info('WhatsApp disconnected', {
            meta: {
                reasonCode,
                reason: disconnectReasonLabel(reasonCode),
                error: serializeError(lastDisconnect?.error)
            }
        })

        teardownSocket()

        if (reasonCode === DisconnectReason.loggedOut) {
            try {
                if (fs.existsSync(AUTH_DIR)) {
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
                    whatsappLogger.info('Cleared WhatsApp auth after logout from phone')
                }
            } catch (error) {
                whatsappLogger.error('Failed to clear WhatsApp auth folder', { meta: { error: serializeError(error) } })
            }
            reconnectAttempt = 0
        }

        scheduleReconnect(`connection_close:${disconnectReasonLabel(reasonCode)}`)
        return
    }

    if (connection === 'open') {
        whatsappConnected = true
        latestQr = null
        reconnectAttempt = 0
        clearReconnectTimer()
        io.emit('whatsapp:connected')
        whatsappLogger.info('WhatsApp connected')
        await flushQueueSafely()
    }
}

async function handleWhatsappEvents(events: Record<string, unknown>, io: SocketServer, saveCreds: () => Promise<void>) {
    if (events['connection.update']) {
        await handleConnectionUpdate(io, events['connection.update'] as Parameters<typeof handleConnectionUpdate>[1])
    }

    if (events['creds.update']) {
        await saveCreds()
    }
}

async function startWhatsappConnection(io: SocketServer) {
    if (connecting) return

    connecting = true
    ioRef = io

    try {
        whatsappLogger.info('Starting WhatsApp connection')

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
        const version = await resolveBaileysVersion()

        teardownSocket()

        sock = makeWASocket({
            printQRInTerminal: false,
            auth: state,
            version,
            connectTimeoutMs: 30_000,
            defaultQueryTimeoutMs: 30_000,
            keepAliveIntervalMs: 25_000
        })

        sock.ev.process(async (events) => {
            try {
                await handleWhatsappEvents(events, io, saveCreds)
            } catch (error) {
                whatsappLogger.error('Unhandled error in WhatsApp event handler', { meta: { error: serializeError(error) } })
            }
        })

        whatsappLogger.info('WhatsApp socket created')
    } catch (error) {
        whatsappConnected = false
        latestQr = null
        io.emit('whatsapp:disconnected')
        whatsappLogger.error('WhatsApp connection setup failed', { meta: { error: serializeError(error) } })
        teardownSocket()
        scheduleReconnect('setup_failed')
    } finally {
        connecting = false
    }
}

export function getLatestQr() {
    return latestQr
}

export function isWhatsappConnected() {
    return whatsappConnected
}

/** Fire-and-forget — never throws; logs errors and retries with backoff. */
export function connectWhatsapp(io: SocketServer) {
    clearReconnectTimer()
    reconnectAttempt = 0
    void startWhatsappConnection(io)
}

export async function logoutWhatsapp(io: SocketServer) {
    clearReconnectTimer()
    reconnectAttempt = 0

    try {
        whatsappConnected = false
        latestQr = null
        io.emit('whatsapp:disconnected')

        if (sock) {
            try {
                await sock.logout()
            } catch (error) {
                whatsappLogger.error('WhatsApp logout request failed', { meta: { error: serializeError(error) } })
            }
        }

        teardownSocket()

        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true })
        }

        whatsappLogger.info('WhatsApp logged out locally')
        connectWhatsapp(io)
    } catch (error) {
        whatsappLogger.error('WhatsApp logout failed', { meta: { error: serializeError(error) } })
        throw error
    }
}

function toJid(phoneNumber: string) {
    return `${phoneNumber}@s.whatsapp.net`
}

export async function sendMessage(phoneNumber: string, message: string) {
    if (!sock || !whatsappConnected) {
        throw new Error('WhatsApp is not connected')
    }

    const jid = toJid(phoneNumber)
    try {
        await sock.sendMessage(jid, { text: message })
    } catch (error) {
        whatsappLogger.error('Failed to send WhatsApp text message', {
            meta: { contact: phoneNumber, error: serializeError(error) }
        })
        throw error
    }
}

export async function sendDocument(phoneNumber: string, document: Buffer, fileName: string, mimetype = 'application/pdf') {
    if (!sock || !whatsappConnected) {
        throw new Error('WhatsApp is not connected')
    }

    const jid = toJid(phoneNumber)
    try {
        await sock.sendMessage(jid, {
            document,
            mimetype,
            fileName
        })
    } catch (error) {
        whatsappLogger.error('Failed to send WhatsApp document', {
            meta: { contact: phoneNumber, fileName, error: serializeError(error) }
        })
        throw error
    }
}
