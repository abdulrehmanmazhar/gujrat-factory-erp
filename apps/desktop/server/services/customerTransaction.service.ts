// @ts-nocheck
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customerTransactions, customers } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export type CustomerTransactionType = 'sale' | 'refund' | 'udhar_payment'

export async function createCustomerTransaction(data: {
    customerId: string
    type: CustomerTransactionType | string
    amount: number
    description: string
    createdById: string
    orderId?: string
    proofImage?: string
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
            proofImage: data.proofImage
        })
        .returning()

    return withLegacyId(transaction)
}

export async function deleteCustomerTransaction(id: string) {
    const [target] = await db.select().from(customerTransactions).where(eq(customerTransactions.id, id)).limit(1)
    if (!target) throw new AppError('Customer transaction not found', 404)
    await db.delete(customerTransactions).where(eq(customerTransactions.id, id))
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
