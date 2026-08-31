// @ts-nocheck
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customerTransactions, customers, supplierTransactions, suppliers } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { loadCustomerOwed, loadSupplierPayable } from '../utils/ledger.js'
import { deleteRemoteFile } from '../utils/rclone.js'
import type { PaymentProofFields } from '../utils/paymentMode.js'
import { readAppSettings } from '../utils/appSettings.js'
import { normalizeDocumentLanguage, type DocumentLanguage } from '../utils/documentI18n.js'
import { formatWhatsAppContact } from '../utils/whatsapp.js'
import logger from '../config/logger.js'

export type KhataParty = 'customer' | 'supplier'
export type KhataDirection = 'in' | 'out'

function parseOptionalDate(value?: string | null, endOfDay = false) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    if (endOfDay) d.setHours(23, 59, 59, 999)
    else d.setHours(0, 0, 0, 0)
    return d
}

function buildCustomerKhataWhatsApp(
    lang: DocumentLanguage,
    payload: {
        customerName: string
        direction: KhataDirection
        amount: number
        paymentMode: string
        remainingBalance: number
        note?: string
    }
) {
    const title = lang === 'ur' ? 'کھاتہ اندراج' : 'Khata entry'
    const directionLabel =
        payload.direction === 'in' ? (lang === 'ur' ? 'وصولی (ان)' : 'Received (In)') : lang === 'ur' ? 'ادائیگی (آؤٹ)' : 'Paid out (Out)'
    const amountLabel = lang === 'ur' ? 'رقم' : 'Amount'
    const modeLabel = lang === 'ur' ? 'طریقہ' : 'Mode'
    const balanceLabel = lang === 'ur' ? 'بقایا بیلنس' : 'Remaining balance'
    const noteLabel = lang === 'ur' ? 'نوٹ' : 'Note'
    const thankYou = lang === 'ur' ? 'شکریہ!' : 'Thank you!'

    const lines = [
        `*${title}*`,
        '',
        payload.customerName,
        `${directionLabel}: PKR ${payload.amount.toLocaleString()}`,
        `${modeLabel}: ${payload.paymentMode}`,
        `${balanceLabel}: PKR ${payload.remainingBalance.toLocaleString()}`
    ]
    if (payload.note?.trim()) {
        lines.push(`${noteLabel}: ${payload.note.trim()}`)
    }
    lines.push('', thankYou)
    return lines.join('\n')
}

export async function listCustomerKhata(filters?: { from?: string; to?: string; search?: string }) {
    const from = parseOptionalDate(filters?.from)
    const to = parseOptionalDate(filters?.to, true)
    const conditions = [isNull(customerTransactions.orderId)]
    if (from) conditions.push(gte(customerTransactions.createdAt, from))
    if (to) conditions.push(lte(customerTransactions.createdAt, to))

    const rows = await db
        .select({ transaction: customerTransactions, customer: customers })
        .from(customerTransactions)
        .leftJoin(customers, eq(customerTransactions.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(desc(customerTransactions.createdAt))

    const search = filters?.search?.trim().toLowerCase()
    return rows
        .map(({ transaction, customer }) => {
            const direction: KhataDirection = transaction.type === 'udhar_payment' ? 'in' : 'out'
            return {
                ...withLegacyId(transaction),
                party: 'customer' as const,
                direction,
                partyName: customer?.name ?? '—',
                balanceImpact: direction === 'in' ? 'udhar −' : 'udhar +',
                customer: customer ? { id: customer.id, name: customer.name } : null
            }
        })
        .filter((row) => {
            if (!search) return true
            return (
                row.partyName.toLowerCase().includes(search) ||
                row.description.toLowerCase().includes(search) ||
                row.paymentMode.toLowerCase().includes(search) ||
                row.direction.includes(search)
            )
        })
}

export async function listSupplierKhata(filters?: { from?: string; to?: string; search?: string }) {
    const from = parseOptionalDate(filters?.from)
    const to = parseOptionalDate(filters?.to, true)
    const conditions = [isNull(supplierTransactions.restockOrderId)]
    if (from) conditions.push(gte(supplierTransactions.createdAt, from))
    if (to) conditions.push(lte(supplierTransactions.createdAt, to))

    const rows = await db
        .select({ transaction: supplierTransactions, supplier: suppliers })
        .from(supplierTransactions)
        .leftJoin(suppliers, eq(supplierTransactions.supplierId, suppliers.id))
        .where(and(...conditions))
        .orderBy(desc(supplierTransactions.createdAt))

    const search = filters?.search?.trim().toLowerCase()
    return rows
        .map(({ transaction, supplier }) => {
            const direction: KhataDirection = transaction.type === 'payment' ? 'out' : 'in'
            return {
                ...withLegacyId(transaction),
                party: 'supplier' as const,
                direction,
                partyName: supplier?.name ?? '—',
                balanceImpact: direction === 'out' ? 'payable −' : 'payable +',
                supplier: supplier ? { id: supplier.id, name: supplier.name } : null
            }
        })
        .filter((row) => {
            if (!search) return true
            return (
                row.partyName.toLowerCase().includes(search) ||
                row.description.toLowerCase().includes(search) ||
                row.paymentMode.toLowerCase().includes(search) ||
                row.direction.includes(search)
            )
        })
}

export async function createCustomerKhataEntry(data: {
    customerId: string
    direction: KhataDirection
    amount: number
    description?: string
    createdById: string
    proof: PaymentProofFields
}) {
    if (!data.customerId) throw new AppError('Customer is required', 400)
    if (typeof data.amount !== 'number' || Number.isNaN(data.amount) || data.amount <= 0) {
        throw new AppError('Amount must be a positive number', 400)
    }
    if (data.direction !== 'in' && data.direction !== 'out') {
        throw new AppError('Direction must be in or out', 400)
    }

    const result = await db.transaction(async (tx) => {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, data.customerId)).limit(1)
        if (!customer) throw new AppError('Customer not found', 404)

        const type = data.direction === 'in' ? 'udhar_payment' : 'refund'
        const currentOwed = await loadCustomerOwed(tx, data.customerId)
        if (data.direction === 'in' && data.amount > currentOwed) {
            throw new AppError('Cannot receive more than current outstanding balance', 400)
        }

        const description =
            data.description?.trim() ||
            (data.direction === 'in'
                ? `Khata In — ${customer.name} paid PKR ${data.amount}`
                : `Khata Out — paid PKR ${data.amount} to ${customer.name}`)

        const [transaction] = await tx
            .insert(customerTransactions)
            .values({
                id: createId(),
                customerId: data.customerId,
                orderId: null,
                type,
                amount: data.amount,
                description,
                paymentMode: data.proof.paymentMode,
                proofImage: data.proof.proofImage,
                proofImagePublicId: data.proof.proofImagePublicId,
                createdById: data.createdById
            })
            .returning()

        const remainingBalance = await loadCustomerOwed(tx, data.customerId)

        return {
            transaction: withLegacyId(transaction),
            customer,
            remainingBalance,
            direction: data.direction
        }
    })

    try {
        const contact = formatWhatsAppContact(result.customer.contact)
        if (contact) {
            const lang = normalizeDocumentLanguage(readAppSettings().documentLanguage)
            const message = buildCustomerKhataWhatsApp(lang, {
                customerName: result.customer.name,
                direction: result.direction,
                amount: data.amount,
                paymentMode: data.proof.paymentMode,
                remainingBalance: result.remainingBalance,
                note: data.description
            })
            const { enqueueWhatsAppText } = await import('../utils/whatsappQueue.js')
            await enqueueWhatsAppText(contact, message)
        }
    } catch (error) {
        logger.error('Failed to queue Khata WhatsApp message', { meta: { error, customerId: data.customerId } })
    }

    return {
        ...result.transaction,
        party: 'customer' as const,
        direction: result.direction,
        partyName: result.customer.name,
        balanceImpact: result.direction === 'in' ? 'udhar −' : 'udhar +',
        remainingBalance: result.remainingBalance
    }
}

export async function createSupplierKhataEntry(data: {
    supplierId: string
    direction: KhataDirection
    amount: number
    description?: string
    createdById: string
    proof: PaymentProofFields
}) {
    if (!data.supplierId) throw new AppError('Supplier is required', 400)
    if (typeof data.amount !== 'number' || Number.isNaN(data.amount) || data.amount <= 0) {
        throw new AppError('Amount must be a positive number', 400)
    }
    if (data.direction !== 'in' && data.direction !== 'out') {
        throw new AppError('Direction must be in or out', 400)
    }

    return db.transaction(async (tx) => {
        const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, data.supplierId)).limit(1)
        if (!supplier) throw new AppError('Supplier not found', 404)

        const type = data.direction === 'out' ? 'payment' : 'refund'
        const currentPayable = await loadSupplierPayable(tx, data.supplierId)
        if (data.direction === 'out' && data.amount > currentPayable) {
            throw new AppError('Cannot pay more than current payable', 400)
        }

        const description =
            data.description?.trim() ||
            (data.direction === 'out'
                ? `Khata Out — paid PKR ${data.amount} to ${supplier.name}`
                : `Khata In — refund PKR ${data.amount} from ${supplier.name}`)

        const [transaction] = await tx
            .insert(supplierTransactions)
            .values({
                id: createId(),
                supplierId: data.supplierId,
                restockOrderId: null,
                type,
                amount: data.amount,
                description,
                paymentMode: data.proof.paymentMode,
                proofImage: data.proof.proofImage,
                proofImagePublicId: data.proof.proofImagePublicId,
                createdById: data.createdById
            })
            .returning()

        const remainingPayable = await loadSupplierPayable(tx, data.supplierId)

        return {
            ...withLegacyId(transaction),
            party: 'supplier' as const,
            direction: data.direction,
            partyName: supplier.name,
            balanceImpact: data.direction === 'out' ? 'payable −' : 'payable +',
            remainingBalance: remainingPayable
        }
    })
}

export async function deleteKhataEntry(party: KhataParty, id: string) {
    if (party === 'customer') {
        const [existing] = await db.select().from(customerTransactions).where(eq(customerTransactions.id, id)).limit(1)
        if (!existing) throw new AppError('Khata entry not found', 404)
        if (existing.orderId) throw new AppError('Only standalone Khata entries can be deleted here', 400)

        await db.transaction(async (tx) => {
            await tx.delete(customerTransactions).where(eq(customerTransactions.id, id))
        })

        if (existing.proofImagePublicId) {
            await deleteRemoteFile(existing.proofImagePublicId)
        }
        return
    }

    const [existing] = await db.select().from(supplierTransactions).where(eq(supplierTransactions.id, id)).limit(1)
    if (!existing) throw new AppError('Khata entry not found', 404)
    if (existing.restockOrderId) throw new AppError('Only standalone Khata entries can be deleted here', 400)

    await db.transaction(async (tx) => {
        await tx.delete(supplierTransactions).where(eq(supplierTransactions.id, id))
    })

    if (existing.proofImagePublicId) {
        await deleteRemoteFile(existing.proofImagePublicId)
    }
}
