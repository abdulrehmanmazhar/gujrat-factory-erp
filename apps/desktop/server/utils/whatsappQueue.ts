// @ts-nocheck
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db.js'
import { whatsappQueue } from '../models/tables.js'
import { logger } from '../config/logger.js'
import { createId } from './mappers.js'
import { formatWhatsAppContact, isWhatsappConnected, sendDocument, sendMessage } from './whatsapp.js'
import { getIo } from './socket.js'
import { downloadBuffer, downloadText, uploadBuffer } from './rclone.js'

const MAX_ATTEMPTS = 5
let processing = false

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

export async function getWhatsAppQueueStats() {
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

    const recent = await db
        .select({
            id: whatsappQueue.id,
            contact: whatsappQueue.contact,
            kind: whatsappQueue.kind,
            status: whatsappQueue.status,
            attempts: whatsappQueue.attempts,
            lastError: whatsappQueue.lastError,
            createdAt: whatsappQueue.createdAt,
            updatedAt: whatsappQueue.updatedAt
        })
        .from(whatsappQueue)
        .orderBy(desc(whatsappQueue.updatedAt))
        .limit(25)

    return { counts, recent }
}

export async function broadcastWhatsAppQueueStats() {
    try {
        const stats = await getWhatsAppQueueStats()
        getIo()?.emit('whatsapp:queue:update', stats)
    } catch (error) {
        logger.error('Failed to broadcast WhatsApp queue stats', { meta: { error } })
    }
}

export async function enqueueWhatsAppText(contact: string, message: string) {
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
            status: 'pending'
        })
        .returning()

    await broadcastWhatsAppQueueStats()
    return row.id
}

export async function enqueueWhatsAppDocument(contact: string, fileName: string, pdfBuffer: Buffer, caption?: string) {
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
            status: 'pending'
        })
        .returning()

    await broadcastWhatsAppQueueStats()
    return row.id
}

async function bumpAttempt(id: string, error: string) {
    const [row] = await db.select().from(whatsappQueue).where(eq(whatsappQueue.id, id)).limit(1)
    if (!row) return

    const attempts = (row.attempts ?? 0) + 1
    await db
        .update(whatsappQueue)
        .set({
            attempts,
            lastError: error,
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            updatedAt: new Date()
        })
        .where(eq(whatsappQueue.id, id))
}

async function deliverItem(item: typeof whatsappQueue.$inferSelect) {
    const parsed = parsePayload(item.payload)

    if (isFileRef(parsed)) {
        if (item.kind === 'text') {
            const message = await downloadText(parsed.remotePath)
            await sendMessage(item.contact, message)
            return
        }

        if (item.kind === 'document') {
            const fileBuffer = await downloadBuffer(parsed.remotePath)
            const fileName = parsed.fileName || 'document.pdf'
            await sendDocument(item.contact, fileBuffer, fileName)
            if (parsed.captionRemotePath) {
                const caption = await downloadText(parsed.captionRemotePath)
                await sendMessage(item.contact, caption)
            }
            return
        }
    }

    // Legacy embedded payloads (pre-rclone rows)
    if (item.kind === 'text') {
        const { message } = parsed as QueueTextPayload
        await sendMessage(item.contact, message)
        return
    }

    if (item.kind === 'document') {
        const { fileName, pdfBase64, caption } = parsed as QueueDocumentPayload
        await sendDocument(item.contact, Buffer.from(pdfBase64, 'base64'), fileName)
        if (caption) await sendMessage(item.contact, caption)
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
                await db.update(whatsappQueue).set({ status: 'sent', lastError: null, updatedAt: new Date() }).where(eq(whatsappQueue.id, item.id))
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
