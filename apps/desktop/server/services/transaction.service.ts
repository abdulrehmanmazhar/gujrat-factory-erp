// @ts-nocheck
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { productSales, transactions } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export async function createTransaction(data: {
    type: string
    amount: number
    description: string
    createdById: string
    orderId?: string
    proofImage?: string
}) {
    const [transaction] = await db
        .insert(transactions)
        .values({
            id: createId(),
            type: data.type,
            amount: data.amount,
            description: data.description,
            createdById: data.createdById,
            orderId: data.orderId,
            proofImage: data.proofImage
        })
        .returning()

    return withLegacyId(transaction)
}

export async function deleteTransaction(id: string) {
    const [target] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1)
    if (!target) throw new AppError('Targetted transaction not found', 400)
    await db.delete(transactions).where(eq(transactions.id, id))
}

export async function listTransactions() {
    const rows = await db.select().from(transactions).orderBy(desc(transactions.createdAt))
    if (!rows.length) throw new AppError('No transactions found', 404)
    return rows.map(withLegacyId)
}

export async function listTodayTransactions() {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const rows = await db
        .select()
        .from(transactions)
        .where(and(gte(transactions.createdAt, startOfDay), lte(transactions.createdAt, endOfDay)))
        .orderBy(desc(transactions.createdAt))

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
            ? and(eq(transactions.type, 'sale'), gte(transactions.createdAt, start), lte(transactions.createdAt, end))
            : eq(transactions.type, 'sale')

    const rows = await db.select().from(transactions).where(filter).orderBy(desc(transactions.createdAt))
    return rows.map(withLegacyId)
}

export async function getProductSalesByDateRange(productId: string, dateRange: string, startDate?: string, endDate?: string) {
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
            ? and(eq(productSales.productId, productId), gte(productSales.createdAt, start), lte(productSales.createdAt, end))
            : eq(productSales.productId, productId)

    const rows = await db.select().from(productSales).where(filter).orderBy(desc(productSales.createdAt))
    return rows.map(withLegacyId)
}
