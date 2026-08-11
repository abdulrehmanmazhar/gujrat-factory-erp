import fs from 'fs'
import type { Server as SocketServer } from 'socket.io'
import pino from 'pino'
import {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeWASocket,
    useMultiFileAuthState,
    WAMessageStatus,
    type WAMessage,
    type WAMessageUpdate,
    type WASocket
} from 'baileys'
import { whatsappLogger } from '../config/logger.js'
import { normalizeWhatsAppContact } from './phone.js'

export { normalizeWhatsAppContact as formatWhatsAppContact }

const AUTH_DIR = 'auth'
const RECONNECT_BASE_MS = 5_000
const RECONNECT_MAX_MS = 60_000
/** Used when fetchLatestBaileysVersion fails (offline / blocked). */
const FALLBACK_BAILEYS_VERSION: [number, number, number] = [2, 3000, 1043857760]
/** How long to wait for WhatsApp server ACK / ERROR after sendMessage resolves. */
const SEND_ACK_TIMEOUT_MS = Number(process.env.WHATSAPP_ACK_TIMEOUT_MS || 25_000)

const baileysPino = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'warn' })

let sock: WASocket | undefined
let latestQr: string | null = null
let whatsappConnected = false
let ioRef: SocketServer | null = null
let connecting = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0

type AckWaiter = {
    resolve: () => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
}

/** In-flight sends waiting for server ACK / ERROR by Baileys message id. */
const pendingAcks = new Map<string, AckWaiter>()
/** Recent updates that may arrive before the waiter is registered (race buffer). */
const recentAckUpdates = new Map<string, WAMessageUpdate['update']>()
/** Optional queue item linkage for late ERROR after a send was accepted. */
const outboundQueueByMsgId = new Map<string, string>()

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return { message: error.message, stack: error.stack, name: error.name }
    }
    return { message: String(error) }
}

export function describeWhatsAppSendError(error: unknown): string {
    const raw =
        error instanceof Error
            ? error.message
            : typeof error === 'object' && error && 'message' in error
              ? String((error as { message: unknown }).message)
              : String(error)

    const text = raw.toLowerCase()
    if (text.includes('463') || text.includes('reachout') || text.includes('timelock') || text.includes('restricted') || text.includes('tctoken')) {
        return 'WhatsApp rejected send (463 reach-out / account restriction)'
    }
    if (text.includes('not connected')) {
        return 'WhatsApp is not connected'
    }
    if (text.includes('timed out') || text.includes('timeout')) {
        return 'WhatsApp send timed out waiting for server confirmation'
    }
    return raw || 'WhatsApp send failed'
}

function errorFromAckUpdate(update: WAMessageUpdate['update']): Error | null {
    const stubParams = (update.messageStubParameters ?? []).map((p) => String(p))
    const status = update.status
    const has463 = stubParams.some((p) => p.includes('463') || p.toLowerCase().includes('restrict') || p.toLowerCase().includes('tctoken'))
    const isErrorStatus = status === WAMessageStatus.ERROR

    if (!isErrorStatus && !has463) return null

    const code = stubParams.find((p) => /^\d+$/.test(p)) || stubParams[0]
    if (code === '463' || has463) {
        return new Error('WhatsApp rejected send (463 reach-out / account restriction)')
    }
    if (code) {
        return new Error(`WhatsApp rejected send (ACK error ${code})`)
    }
    return new Error('WhatsApp rejected send (server ACK error)')
}

function isSuccessfulAck(update: WAMessageUpdate['update']) {
    const status = update.status
    return typeof status === 'number' && status >= WAMessageStatus.SERVER_ACK
}

function settlePendingAck(messageId: string, update: WAMessageUpdate['update']) {
    const ackError = errorFromAckUpdate(update)
    const waiter = pendingAcks.get(messageId)

    if (ackError) {
        whatsappLogger.error('WhatsApp outbound message failed via ACK', {
            meta: { messageId, stubParams: update.messageStubParameters, status: update.status }
        })
        if (waiter) {
            clearTimeout(waiter.timer)
            pendingAcks.delete(messageId)
            waiter.reject(ackError)
        }
        void failLinkedQueueItem(messageId, ackError.message)
        return
    }

    if (waiter && isSuccessfulAck(update)) {
        clearTimeout(waiter.timer)
        pendingAcks.delete(messageId)
        waiter.resolve()
    }
}

async function failLinkedQueueItem(messageId: string, errorMessage: string) {
    const queueItemId = outboundQueueByMsgId.get(messageId)
    if (!queueItemId) return
    outboundQueueByMsgId.delete(messageId)
    try {
        const { markWhatsAppQueueItemFailed } = await import('./whatsappQueue.js')
        await markWhatsAppQueueItemFailed(queueItemId, errorMessage)
    } catch (error) {
        whatsappLogger.error('Failed to mark WhatsApp queue item failed after ACK error', {
            meta: { messageId, queueItemId, error: serializeError(error) }
        })
    }
}

function waitForServerAck(messageId: string, timeoutMs = SEND_ACK_TIMEOUT_MS): Promise<void> {
    const buffered = recentAckUpdates.get(messageId)
    if (buffered) {
        recentAckUpdates.delete(messageId)
        const ackError = errorFromAckUpdate(buffered)
        if (ackError) return Promise.reject(ackError)
        if (isSuccessfulAck(buffered)) return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingAcks.delete(messageId)
            reject(new Error('WhatsApp send timed out waiting for server confirmation'))
        }, timeoutMs)

        pendingAcks.set(messageId, {
            resolve: () => resolve(),
            reject,
            timer
        })
    })
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
    for (const [messageId, waiter] of pendingAcks) {
        clearTimeout(waiter.timer)
        waiter.reject(new Error('WhatsApp disconnected before send was confirmed'))
        pendingAcks.delete(messageId)
    }
    recentAckUpdates.clear()

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

function handleMessageUpdates(updates: WAMessageUpdate[]) {
    for (const updateEvent of updates) {
        const messageId = updateEvent.key?.id
        if (!messageId) continue

        recentAckUpdates.set(messageId, updateEvent.update)
        setTimeout(() => {
            recentAckUpdates.delete(messageId)
        }, SEND_ACK_TIMEOUT_MS + 5_000)

        settlePendingAck(messageId, updateEvent.update)
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

    if (events['messages.update']) {
        handleMessageUpdates(events['messages.update'] as WAMessageUpdate[])
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
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, baileysPino)
            },
            version,
            logger: baileysPino,
            connectTimeoutMs: 30_000,
            defaultQueryTimeoutMs: 60_000,
            keepAliveIntervalMs: 25_000,
            markOnlineOnConnect: false,
            syncFullHistory: false
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

function assertImmediateSendResult(result: WAMessage | undefined | null, contact: string, kind: 'text' | 'document') {
    if (!result) {
        throw new Error('WhatsApp send returned no message result')
    }

    const stubParams = result.messageStubParameters
    if (Array.isArray(stubParams) && stubParams.some((p) => String(p).includes('463'))) {
        const err = new Error('WhatsApp rejected send (463 reach-out / account restriction)')
        whatsappLogger.error(`WhatsApp ${kind} send rejected with 463`, {
            meta: { contact, stubParams }
        })
        throw err
    }

    if (result.status === WAMessageStatus.ERROR) {
        throw new Error('WhatsApp rejected send (ERROR status on send result)')
    }

    return result
}

type SendOptions = {
    queueItemId?: string
}

async function sendAndAwaitAck(
    phoneNumber: string,
    content: Parameters<WASocket['sendMessage']>[1],
    kind: 'text' | 'document',
    options?: SendOptions
) {
    if (!sock || !whatsappConnected) {
        throw new Error('WhatsApp is not connected')
    }

    const jid = toJid(phoneNumber)
    let messageId: string | undefined

    try {
        const result = assertImmediateSendResult(await sock.sendMessage(jid, content), phoneNumber, kind)
        messageId = result.key?.id ?? undefined
        if (!messageId) {
            throw new Error('WhatsApp send returned a message without an id')
        }

        if (options?.queueItemId) {
            outboundQueueByMsgId.set(messageId, options.queueItemId)
        }

        await waitForServerAck(messageId)
        if (options?.queueItemId) {
            setTimeout(() => {
                if (outboundQueueByMsgId.get(messageId!) === options.queueItemId) {
                    outboundQueueByMsgId.delete(messageId!)
                }
            }, 60_000)
        }
        return result
    } catch (error) {
        if (messageId) outboundQueueByMsgId.delete(messageId)
        const mapped = describeWhatsAppSendError(error)
        whatsappLogger.error(`Failed to send WhatsApp ${kind}`, {
            meta: { contact: phoneNumber, messageId, error: serializeError(error), mapped, queueItemId: options?.queueItemId }
        })
        throw new Error(mapped)
    }
}

export async function sendMessage(phoneNumber: string, message: string, options?: SendOptions) {
    return sendAndAwaitAck(phoneNumber, { text: message }, 'text', options)
}

export async function sendDocument(phoneNumber: string, document: Buffer, fileName: string, mimetype = 'application/pdf', options?: SendOptions) {
    return sendAndAwaitAck(
        phoneNumber,
        {
            document,
            mimetype,
            fileName
        },
        'document',
        options
    )
}
