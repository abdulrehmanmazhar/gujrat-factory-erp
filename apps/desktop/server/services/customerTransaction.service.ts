// @ts-nocheck
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customerTransactions, customers, orders } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { deleteRemoteFile } from '../utils/rclone.js'

export type CustomerTransactionType = 'sale' | 'refund' | 'udhar_payment' | 'order' | 'order_credit'

export async function createCustomerTransaction(data: {
    customerId: string
    type: CustomerTransactionType | string
    amount: number
    description: string
    createdById: string
    orderId?: string
    paymentMode?: string
    proofImage?: string
    proofImagePublicId?: string
}) {
    const [transaction] = await db
        .insert(customerTransactions)
        .values({
            id: createId(),
            customerId: data.customerId,
            orderId: data.orderId,
            type: data.type,
            amount: data.amount,
            description: data.description,
            createdById: data.createdById,
            paymentMode: data.paymentMode ?? 'cash',
            proofImage: data.proofImage,
            proofImagePublicId: data.proofImagePublicId
        })
        .returning()

    return withLegacyId(transaction)
}

export async function deleteCustomerTransaction(id: string) {
    const [target] = await db.select().from(customerTransactions).where(eq(customerTransactions.id, id)).limit(1)
    if (!target) throw new AppError('Customer transaction not found', 404)

    await db.transaction(async (tx) => {
        if (target.orderId) {
            const [order] = await tx.select().from(orders).where(eq(orders.id, target.orderId)).limit(1)
            if (target.type === 'order') {
                if (order && (order.status === 'saved' || !order.status)) {
                    throw new AppError('Invoice charges cannot be deleted while the order is active. Cancel or return the order instead.', 400)
                }
                const siblings = await tx.select().from(customerTransactions).where(eq(customerTransactions.orderId, target.orderId))
                const hasPayments = siblings.some((row) => row.id !== id && (row.type === 'sale' || row.type === 'refund' || row.type === 'udhar_payment'))
                if (hasPayments) {
                    throw new AppError('Delete order payments and refunds before deleting the invoice charge.', 400)
                }
            } else if (order && (target.type === 'sale' || target.type === 'udhar_payment')) {
                await tx
                    .update(orders)
                    .set({ payment: Math.max(0, (order.payment ?? 0) - target.amount), updatedAt: new Date() })
                    .where(eq(orders.id, order.id))
            } else if (order && target.type === 'refund') {
                await tx
                    .update(orders)
                    .set({ refunded: Math.max(0, (order.refunded ?? 0) - target.amount), updatedAt: new Date() })
                    .where(eq(orders.id, order.id))
            }
        }

        await tx.delete(customerTransactions).where(eq(customerTransactions.id, id))
    })

    if (target.proofImagePublicId) {
        await deleteRemoteFile(target.proofImagePublicId)
    }
}

export async function getCustomerTransaction(id: string) {
    const [txn] = await db.select().from(customerTransactions).where(eq(customerTransactions.id, id)).limit(1)
    if (!txn) throw new AppError('Customer transaction not found', 404)
    return withLegacyId(txn)
}

export async function listCustomerTransactions() {
    const rows = await db.select().from(customerTransactions).orderBy(desc(customerTransactions.createdAt))
    if (!rows.length) throw new AppError('No transactions found', 404)
    return rows.map(withLegacyId)
}

export async function listRecentCustomerTransactions(limit = 10) {
    const rows = await db
        .select({ transaction: customerTransactions, customer: customers })
        .from(customerTransactions)
        .leftJoin(customers, eq(customerTransactions.customerId, customers.id))
        .orderBy(desc(customerTransactions.createdAt))
        .limit(limit)

    return rows.map(({ transaction, customer }) => ({
        ...withLegacyId(transaction),
        customer: customer ? { id: customer.id, name: customer.name } : null
    }))
}

export async function listTodayCustomerTransactions() {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const rows = await db
        .select()
        .from(customerTransactions)
        .where(and(gte(customerTransactions.createdAt, startOfDay), lte(customerTransactions.createdAt, endOfDay)))
        .orderBy(desc(customerTransactions.createdAt))

    return rows.map(withLegacyId)
}

export async function getSalesByDateRange(dateRange: string, startDate?: string, endDate?: string) {
    const now = new Date()
    let start: Date | undefined
    let end: Date | undefined

    if (dateRange === 'today') {
        start = new Date(now.setHours(0, 0, 0, 0))
        end = new Date(now.setHours(23, 59, 59, 999))
    } else if (dateRange === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (dateRange === 'year') {
        start = new Date(now.getFullYear(), 0, 1)
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    } else if (dateRange === 'custom' && startDate && endDate) {
        start = new Date(startDate)
        end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
    }

    const filter =
        start && end
            ? and(eq(customerTransactions.type, 'sale'), gte(customerTransactions.createdAt, start), lte(customerTransactions.createdAt, end))
            : eq(customerTransactions.type, 'sale')

    const rows = await db.select().from(customerTransactions).where(filter).orderBy(desc(customerTransactions.createdAt))
    return rows.map(withLegacyId)
}

export async function getCustomerTransactionWithDetails(id: string) {
    const [txn] = await db.select().from(customerTransactions).where(eq(customerTransactions.id, id)).limit(1)
    if (!txn) return null

    const [customer] = await db.select().from(customers).where(eq(customers.id, txn.customerId)).limit(1)
    return {
        ...withLegacyId(txn),
        customer: customer ? withLegacyId(customer) : null
    }
}
