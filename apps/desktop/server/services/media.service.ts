import { desc, eq, isNotNull, or } from 'drizzle-orm'
import { db } from '../utils/db.js'
import {
    customerTransactions,
    customers,
    miscellaneousExpenditures,
    orders,
    supplierTransactions,
    suppliers,
    whatsappQueue
} from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { downloadBuffer } from '../utils/rclone.js'

export type MediaKindFilter = 'all' | 'proof' | 'invoice' | 'receipt' | 'document'

export type MediaCatalogItem = {
    id: string
    source: 'customer_proof' | 'supplier_proof' | 'misc_proof' | 'whatsapp'
    kind: 'proof' | 'invoice' | 'receipt' | 'document'
    fileName: string
    partyName: string | null
    contact: string | null
    orderNumber: number | null
    amount: number | null
    createdAt: Date | string | null
}

type MediaFileResult = {
    buffer: Buffer
    fileName: string
    contentType: string
}

function parseCompositeId(id: string) {
    const idx = id.indexOf(':')
    if (idx <= 0) throw new AppError('Invalid media id', 400)
    return { source: id.slice(0, idx), entityId: id.slice(idx + 1) }
}

function guessContentType(fileName: string) {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.pdf')) return 'application/pdf'
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8'
    return 'application/octet-stream'
}

function fileNameFromPath(remoteOrUrl: string | null | undefined, fallback: string) {
    if (!remoteOrUrl) return fallback
    const cleaned = remoteOrUrl.split('?')[0]
    const base = cleaned.split('/').pop() || fallback
    return base || fallback
}

function parseOrderNumberFromFileName(fileName: string | null | undefined) {
    if (!fileName) return null
    const match = fileName.match(/(?:Invoice|Payment_Receipt|Receipt|انوائس|رسید)[-_]?(\d+)/i)
    if (!match) return null
    const n = Number(match[1])
    return Number.isFinite(n) ? n : null
}

function parseWhatsAppPayload(payload: string) {
    try {
        return JSON.parse(payload) as { remotePath?: string; fileName?: string }
    } catch {
        return {}
    }
}

function matchesQuery(
    item: MediaCatalogItem,
    q: string
) {
    if (!q) return true
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    const hay = [item.fileName, item.partyName, item.contact, item.orderNumber != null ? String(item.orderNumber) : '']
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    return hay.includes(needle)
}

function matchesKind(item: MediaCatalogItem, kind: MediaKindFilter) {
    if (kind === 'all') return true
    if (kind === 'document') return item.source === 'whatsapp'
    return item.kind === kind
}

export async function listMediaCatalog(options?: { q?: string; kind?: MediaKindFilter; page?: number; limit?: number }) {
    const page = Math.max(1, Number(options?.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(options?.limit) || 20))
    const q = (options?.q ?? '').trim()
    const kind = (options?.kind ?? 'all') as MediaKindFilter

    const [customerProofs, supplierProofs, miscProofs, waDocs, customerRows] = await Promise.all([
        db
            .select({
                id: customerTransactions.id,
                proofImage: customerTransactions.proofImage,
                proofImagePublicId: customerTransactions.proofImagePublicId,
                amount: customerTransactions.amount,
                createdAt: customerTransactions.createdAt,
                customerName: customers.name,
                contact: customers.contact,
                orderNumber: orders.orderNumber
            })
            .from(customerTransactions)
            .leftJoin(customers, eq(customerTransactions.customerId, customers.id))
            .leftJoin(orders, eq(customerTransactions.orderId, orders.id))
            .where(or(isNotNull(customerTransactions.proofImage), isNotNull(customerTransactions.proofImagePublicId)))
            .orderBy(desc(customerTransactions.createdAt)),
        db
            .select({
                id: supplierTransactions.id,
                proofImage: supplierTransactions.proofImage,
                proofImagePublicId: supplierTransactions.proofImagePublicId,
                amount: supplierTransactions.amount,
                createdAt: supplierTransactions.createdAt,
                supplierName: suppliers.name,
                contact: suppliers.contact
            })
            .from(supplierTransactions)
            .leftJoin(suppliers, eq(supplierTransactions.supplierId, suppliers.id))
            .where(or(isNotNull(supplierTransactions.proofImage), isNotNull(supplierTransactions.proofImagePublicId)))
            .orderBy(desc(supplierTransactions.createdAt)),
        db
            .select({
                id: miscellaneousExpenditures.id,
                proofImage: miscellaneousExpenditures.proofImage,
                proofImagePublicId: miscellaneousExpenditures.proofImagePublicId,
                amount: miscellaneousExpenditures.amount,
                note: miscellaneousExpenditures.note,
                createdAt: miscellaneousExpenditures.createdAt
            })
            .from(miscellaneousExpenditures)
            .where(or(isNotNull(miscellaneousExpenditures.proofImage), isNotNull(miscellaneousExpenditures.proofImagePublicId)))
            .orderBy(desc(miscellaneousExpenditures.createdAt)),
        db
            .select({
                id: whatsappQueue.id,
                contact: whatsappQueue.contact,
                payload: whatsappQueue.payload,
                docType: whatsappQueue.docType,
                orderNumber: whatsappQueue.orderNumber,
                displayName: whatsappQueue.displayName,
                customerId: whatsappQueue.customerId,
                createdAt: whatsappQueue.createdAt,
                customerName: customers.name,
                customerContact: customers.contact
            })
            .from(whatsappQueue)
            .leftJoin(customers, eq(whatsappQueue.customerId, customers.id))
            .where(eq(whatsappQueue.kind, 'document'))
            .orderBy(desc(whatsappQueue.createdAt)),
        db.select({ id: customers.id, name: customers.name, contact: customers.contact }).from(customers)
    ])

    const customersByContact = new Map<string, { name: string; contact: string }>()
    for (const row of customerRows) {
        const digits = String(row.contact ?? '').replace(/\D/g, '')
        if (digits) customersByContact.set(digits, { name: row.name, contact: row.contact })
    }

    const items: MediaCatalogItem[] = []

    for (const row of customerProofs) {
        items.push({
            id: `customer_proof:${row.id}`,
            source: 'customer_proof',
            kind: 'proof',
            fileName: fileNameFromPath(row.proofImagePublicId || row.proofImage, 'proof'),
            partyName: row.customerName ?? null,
            contact: row.contact ?? null,
            orderNumber: row.orderNumber ?? null,
            amount: row.amount,
            createdAt: row.createdAt
        })
    }

    for (const row of supplierProofs) {
        items.push({
            id: `supplier_proof:${row.id}`,
            source: 'supplier_proof',
            kind: 'proof',
            fileName: fileNameFromPath(row.proofImagePublicId || row.proofImage, 'proof'),
            partyName: row.supplierName ?? null,
            contact: row.contact ?? null,
            orderNumber: null,
            amount: row.amount,
            createdAt: row.createdAt
        })
    }

    for (const row of miscProofs) {
        items.push({
            id: `misc_proof:${row.id}`,
            source: 'misc_proof',
            kind: 'proof',
            fileName: fileNameFromPath(row.proofImagePublicId || row.proofImage, 'proof'),
            partyName: row.note ?? 'Misc. expenditure',
            contact: null,
            orderNumber: null,
            amount: row.amount,
            createdAt: row.createdAt
        })
    }

    for (const row of waDocs) {
        const payload = parseWhatsAppPayload(row.payload)
        const fileName = row.displayName || payload.fileName || fileNameFromPath(payload.remotePath, 'document.pdf')
        const heuristicOrder = row.orderNumber ?? parseOrderNumberFromFileName(fileName)
        let partyName = row.customerName ?? null
        let contact = row.customerContact ?? row.contact
        if (!partyName && contact) {
            const digits = String(contact).replace(/\D/g, '')
            const match = customersByContact.get(digits)
            if (match) {
                partyName = match.name
                contact = match.contact
            }
        }

        const docType = row.docType === 'invoice' || row.docType === 'receipt' ? row.docType : heuristicOrder && /invoice/i.test(fileName) ? 'invoice' : heuristicOrder && /receipt/i.test(fileName) ? 'receipt' : 'document'

        items.push({
            id: `whatsapp:${row.id}`,
            source: 'whatsapp',
            kind: docType,
            fileName,
            partyName,
            contact,
            orderNumber: heuristicOrder,
            amount: null,
            createdAt: row.createdAt
        })
    }

    const filtered = items
        .filter((item) => matchesKind(item, kind))
        .filter((item) => matchesQuery(item, q))
        .sort((a, b) => {
            const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return bt - at
        })

    const total = filtered.length
    const offset = (page - 1) * limit
    const pageItems = filtered.slice(offset, offset + limit)

    return { items: pageItems, total, page, limit }
}

export async function getMediaFile(id: string): Promise<MediaFileResult> {
    const { source, entityId } = parseCompositeId(id)

    if (source === 'customer_proof') {
        const [row] = await db.select().from(customerTransactions).where(eq(customerTransactions.id, entityId)).limit(1)
        if (!row?.proofImagePublicId && !row?.proofImage) throw new AppError('Proof not found', 404)
        const remotePath = row.proofImagePublicId
        if (!remotePath) throw new AppError('Proof file path missing', 404)
        const fileName = fileNameFromPath(remotePath, 'proof')
        return { buffer: await downloadBuffer(remotePath), fileName, contentType: guessContentType(fileName) }
    }

    if (source === 'supplier_proof') {
        const [row] = await db.select().from(supplierTransactions).where(eq(supplierTransactions.id, entityId)).limit(1)
        if (!row?.proofImagePublicId) throw new AppError('Proof not found', 404)
        const fileName = fileNameFromPath(row.proofImagePublicId, 'proof')
        return { buffer: await downloadBuffer(row.proofImagePublicId), fileName, contentType: guessContentType(fileName) }
    }

    if (source === 'misc_proof') {
        const [row] = await db.select().from(miscellaneousExpenditures).where(eq(miscellaneousExpenditures.id, entityId)).limit(1)
        if (!row?.proofImagePublicId) throw new AppError('Proof not found', 404)
        const fileName = fileNameFromPath(row.proofImagePublicId, 'proof')
        return { buffer: await downloadBuffer(row.proofImagePublicId), fileName, contentType: guessContentType(fileName) }
    }

    if (source === 'whatsapp') {
        const [row] = await db.select().from(whatsappQueue).where(eq(whatsappQueue.id, entityId)).limit(1)
        if (!row || row.kind !== 'document') throw new AppError('Document not found', 404)
        const payload = parseWhatsAppPayload(row.payload)
        if (!payload.remotePath) throw new AppError('Document file path missing', 404)
        const fileName = row.displayName || payload.fileName || fileNameFromPath(payload.remotePath, 'document.pdf')
        return { buffer: await downloadBuffer(payload.remotePath), fileName, contentType: guessContentType(fileName) }
    }

    throw new AppError('Unknown media source', 400)
}
