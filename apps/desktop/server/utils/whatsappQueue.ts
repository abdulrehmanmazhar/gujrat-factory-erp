// @ts-nocheck
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db.js'
import { whatsappQueue } from '../models/tables.js'
import { AppError } from './errors.js'
import { logger } from '../config/logger.js'
import { createId } from './mappers.js'
import { formatWhatsAppContact, isWhatsappConnected, sendDocument, sendMessage } from './whatsapp.js'
import { getIo } from './socket.js'
import { downloadBuffer, downloadText, uploadBuffer } from './rclone.js'

const MAX_ATTEMPTS = 5
let processing = false

function isNonRetryableSendError(message: string) {
    const text = message.toLowerCase()
    return text.includes('463') || text.includes('reach-out') || text.includes('account restriction') || text.includes('tctoken')
}

function kickQueueProcessing() {
    if (!isWhatsappConnected()) return
    processWhatsAppQueue().catch((error) => logger.error('WhatsApp queue flush after enqueue failed', { meta: { error } }))
}

/** Stored in DB — only remote paths, not file contents. */
type QueueFileRef = {
    remotePath: string
    fileName?: string
    captionRemotePath?: string
}

/** Legacy rows may still embed content directly. */
type QueueTextPayload = { message: string }
type QueueDocumentPayload = { fileName: string; pdfBase64: string; caption?: string }

function parsePayload(payload: string): QueueFileRef | QueueTextPayload | QueueDocumentPayload {
    return JSON.parse(payload)
}

function isFileRef(payload: QueueFileRef | QueueTextPayload | QueueDocumentPayload): payload is QueueFileRef {
    return typeof (payload as QueueFileRef).remotePath === 'string'
}

const QUEUE_STATUSES = ['pending', 'processing', 'sent', 'failed'] as const
export type WhatsAppQueueStatus = (typeof QUEUE_STATUSES)[number]

async function getWhatsAppQueueCounts() {
    const countsRows = await db
        .select({
            status: whatsappQueue.status,
            count: sql<number>`count(*)`.mapWith(Number)
        })
        .from(whatsappQueue)
        .groupBy(whatsappQueue.status)

    const counts = { pending: 0, processing: 0, sent: 0, failed: 0, total: 0 }
    for (const row of countsRows) {
        const key = row.status as keyof typeof counts
        if (key in counts && key !== 'total') counts[key] = row.count
        counts.total += row.count
    }
    return counts
}

const queueListColumns = {
    id: whatsappQueue.id,
    contact: whatsappQueue.contact,
    kind: whatsappQueue.kind,
    status: whatsappQueue.status,
    attempts: whatsappQueue.attempts,
    lastError: whatsappQueue.lastError,
    createdAt: whatsappQueue.createdAt,
    updatedAt: whatsappQueue.updatedAt
}

export async function getWhatsAppQueueStats() {
    const counts = await getWhatsAppQueueCounts()
    const recent = await db.select(queueListColumns).from(whatsappQueue).orderBy(desc(whatsappQueue.updatedAt)).limit(25)
    return { counts, recent }
}

export async function listWhatsAppQueue(options?: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(options?.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(options?.limit) || 20))
    const offset = (page - 1) * limit
    const status = options?.status?.trim()
    const statusFilter =
        status && status !== 'all' && QUEUE_STATUSES.includes(status as WhatsAppQueueStatus)
            ? eq(whatsappQueue.status, status)
            : undefined

    const where = statusFilter ? and(statusFilter) : undefined

    const [items, totalRow, counts] = await Promise.all([
        db
            .select(queueListColumns)
            .from(whatsappQueue)
            .where(where)
            .orderBy(desc(whatsappQueue.updatedAt))
            .limit(limit)
            .offset(offset),
        db.select({ total: count() }).from(whatsappQueue).where(where),
        getWhatsAppQueueCounts()
    ])

    return {
        items,
        total: totalRow[0]?.total ?? 0,
        page,
        limit,
        counts
    }
}

async function resetQueueItemToPending(id: string) {
    await db
        .update(whatsappQueue)
        .set({
            status: 'pending',
            attempts: 0,
            lastError: null,
            updatedAt: new Date()
        })
        .where(eq(whatsappQueue.id, id))
}

export async function retryWhatsAppQueueItem(id: string) {
    const [row] = await db.select().from(whatsappQueue).where(eq(whatsappQueue.id, id)).limit(1)
    if (!row) throw new AppError('Queue item not found', 404)
    if (row.status !== 'failed' && row.status !== 'processing') {
        throw new AppError('Only failed or stuck processing items can be retried', 400)
    }

    await resetQueueItemToPending(id)
    await broadcastWhatsAppQueueStats()
    kickQueueProcessing()
    return { id, status: 'pending' as const }
}

export async function retryFailedWhatsAppQueueItems() {
    const failed = await db.select({ id: whatsappQueue.id }).from(whatsappQueue).where(eq(whatsappQueue.status, 'failed'))
    for (const row of failed) {
        await resetQueueItemToPending(row.id)
    }
    await broadcastWhatsAppQueueStats()
    if (failed.length > 0) kickQueueProcessing()
    return { retried: failed.length }
}

export async function broadcastWhatsAppQueueStats() {
    try {
        const stats = await getWhatsAppQueueStats()
        getIo()?.emit('whatsapp:queue:update', stats)
    } catch (error) {
        logger.error('Failed to broadcast WhatsApp queue stats', { meta: { error } })
    }
}

export type WhatsAppEnqueueMeta = {
    customerId?: string | null
    orderId?: string | null
    transactionId?: string | null
    docType?: 'invoice' | 'receipt' | 'text' | 'other' | null
    orderNumber?: number | null
    displayName?: string | null
}

export async function enqueueWhatsAppText(contact: string, message: string, meta?: WhatsAppEnqueueMeta) {
    const normalized = formatWhatsAppContact(contact)
    if (!normalized) {
        logger.info('Invalid WhatsApp contact; message not queued', { meta: { contact } })
        return null
    }

    const id = createId()
    const { remotePath } = await uploadBuffer(Buffer.from(message, 'utf8'), `whatsapp-queue/${id}/message.txt`)
    const payload: QueueFileRef = { remotePath, fileName: 'message.txt' }

    const [row] = await db
        .insert(whatsappQueue)
        .values({
            id,
            contact: normalized,
            kind: 'text',
            payload: JSON.stringify(payload),
            status: 'pending',
            customerId: meta?.customerId ?? null,
            orderId: meta?.orderId ?? null,
            transactionId: meta?.transactionId ?? null,
            docType: meta?.docType ?? 'text',
            orderNumber: meta?.orderNumber ?? null,
            displayName: meta?.displayName ?? 'WhatsApp message'
        })
        .returning()

    await broadcastWhatsAppQueueStats()
    kickQueueProcessing()
    return row.id
}

export async function enqueueWhatsAppDocument(
    contact: string,
    fileName: string,
    pdfBuffer: Buffer,
    caption?: string,
    meta?: WhatsAppEnqueueMeta
) {
    const normalized = formatWhatsAppContact(contact)
    if (!normalized) {
        logger.info('Invalid WhatsApp contact; document not queued', { meta: { contact } })
        return null
    }

    const id = createId()
    const safeName = fileName.replace(/[^\w.\-]+/g, '_') || 'document.pdf'
    const { remotePath } = await uploadBuffer(pdfBuffer, `whatsapp-queue/${id}/${safeName}`)

    const payload: QueueFileRef = { remotePath, fileName: safeName }
    if (caption) {
        const captionUpload = await uploadBuffer(Buffer.from(caption, 'utf8'), `whatsapp-queue/${id}/caption.txt`)
        payload.captionRemotePath = captionUpload.remotePath
    }

    const [row] = await db
        .insert(whatsappQueue)
        .values({
            id,
            contact: normalized,
            kind: 'document',
            payload: JSON.stringify(payload),
            status: 'pending',
            customerId: meta?.customerId ?? null,
            orderId: meta?.orderId ?? null,
            transactionId: meta?.transactionId ?? null,
            docType: meta?.docType ?? 'other',
            orderNumber: meta?.orderNumber ?? null,
            displayName: meta?.displayName ?? safeName
        })
        .returning()

    await broadcastWhatsAppQueueStats()
    kickQueueProcessing()
    return row.id
}

async function bumpAttempt(id: string, error: string) {
    const [row] = await db.select().from(whatsappQueue).where(eq(whatsappQueue.id, id)).limit(1)
    if (!row) return

    const attempts = (row.attempts ?? 0) + 1
    const failed = isNonRetryableSendError(error) || attempts >= MAX_ATTEMPTS
    await db
        .update(whatsappQueue)
        .set({
            attempts,
            lastError: error,
            status: failed ? 'failed' : 'pending',
            updatedAt: new Date()
        })
        .where(eq(whatsappQueue.id, id))
}

/** Flip a queue row to failed after a late Baileys ACK error (even if already marked sent). */
export async function markWhatsAppQueueItemFailed(id: string, error: string) {
    const [row] = await db.select().from(whatsappQueue).where(eq(whatsappQueue.id, id)).limit(1)
    if (!row) return

    if (row.status === 'failed') {
        await db.update(whatsappQueue).set({ lastError: error, updatedAt: new Date() }).where(eq(whatsappQueue.id, id))
        await broadcastWhatsAppQueueStats()
        return
    }

    const attempts = Math.max(row.attempts ?? 0, 1)
    await db
        .update(whatsappQueue)
        .set({
            status: 'failed',
            attempts,
            lastError: error,
            updatedAt: new Date()
        })
        .where(eq(whatsappQueue.id, id))

    logger.error('WhatsApp queue item marked failed after send ACK error', {
        meta: { id, previousStatus: row.status, error }
    })
    await broadcastWhatsAppQueueStats()
}

async function deliverItem(item: typeof whatsappQueue.$inferSelect) {
    const parsed = parsePayload(item.payload)
    const sendOpts = { queueItemId: item.id }

    if (isFileRef(parsed)) {
        if (item.kind === 'text') {
            const message = await downloadText(parsed.remotePath)
            await sendMessage(item.contact, message, sendOpts)
            return
        }

        if (item.kind === 'document') {
            const fileBuffer = await downloadBuffer(parsed.remotePath)
            const fileName = parsed.fileName || 'document.pdf'
            await sendDocument(item.contact, fileBuffer, fileName, 'application/pdf', sendOpts)
            if (parsed.captionRemotePath) {
                const caption = await downloadText(parsed.captionRemotePath)
                await sendMessage(item.contact, caption, sendOpts)
            }
            return
        }
    }

    // Legacy embedded payloads (pre-rclone rows)
    if (item.kind === 'text') {
        const { message } = parsed as QueueTextPayload
        await sendMessage(item.contact, message, sendOpts)
        return
    }

    if (item.kind === 'document') {
        const { fileName, pdfBase64, caption } = parsed as QueueDocumentPayload
        await sendDocument(item.contact, Buffer.from(pdfBase64, 'base64'), fileName, 'application/pdf', sendOpts)
        if (caption) await sendMessage(item.contact, caption, sendOpts)
        return
    }

    throw new Error(`Unsupported WhatsApp queue kind: ${item.kind}`)
}

export async function processWhatsAppQueue(limit = 10) {
    if (processing) return
    processing = true

    try {
        if (!isWhatsappConnected()) return

        const pending = await db
            .select()
            .from(whatsappQueue)
            .where(inArray(whatsappQueue.status, ['pending', 'processing']))
            .orderBy(asc(whatsappQueue.createdAt))
            .limit(limit)

        for (const item of pending) {
            if ((item.attempts ?? 0) >= MAX_ATTEMPTS) {
                await db.update(whatsappQueue).set({ status: 'failed', updatedAt: new Date() }).where(eq(whatsappQueue.id, item.id))
                continue
            }

            await db.update(whatsappQueue).set({ status: 'processing', updatedAt: new Date() }).where(eq(whatsappQueue.id, item.id))

            try {
                await deliverItem(item)
                // Re-read in case a late ACK already flipped this row to failed while we waited.
                const [fresh] = await db.select().from(whatsappQueue).where(eq(whatsappQueue.id, item.id)).limit(1)
                if (fresh?.status === 'failed') {
                    logger.error('WhatsApp queue item failed via ACK after deliver returned', {
                        meta: { id: item.id, lastError: fresh.lastError }
                    })
                } else {
                    await db
                        .update(whatsappQueue)
                        .set({ status: 'sent', lastError: null, updatedAt: new Date() })
                        .where(eq(whatsappQueue.id, item.id))
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                logger.error('WhatsApp queue delivery failed', { meta: { id: item.id, error: message } })
                await bumpAttempt(item.id, message)
            }
        }

        await broadcastWhatsAppQueueStats()
    } finally {
        processing = false
    }
}

export function startWhatsAppQueueWorker(intervalMs = 15_000) {
    processWhatsAppQueue().catch((error) => logger.error('WhatsApp queue worker error', { meta: { error } }))
    setInterval(() => {
        processWhatsAppQueue().catch((error) => logger.error('WhatsApp queue worker error', { meta: { error } }))
    }, intervalMs)
}
