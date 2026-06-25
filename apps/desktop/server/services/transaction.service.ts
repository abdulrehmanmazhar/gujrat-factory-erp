// @ts-nocheck
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { orders, productSales } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { withLegacyId } from '../utils/mappers.js'
import * as customerTransactionService from './customerTransaction.service.js'

export * from './customerTransaction.service.js'
export * from './supplierTransaction.service.js'

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

export async function createTransaction(data: {
    type: string
    amount: number
    description: string
    createdById: string
    orderId?: string
    customerId?: string
    proofImage?: string
}) {
    let customerId = data.customerId
    if (!customerId && data.orderId) {
        const [order] = await db.select().from(orders).where(eq(orders.id, data.orderId)).limit(1)
        customerId = order?.customerId
    }
    if (!customerId) throw new AppError('customerId or valid orderId is required', 400)

    const type = data.type === 'order_refund' ? 'refund' : data.type
    return customerTransactionService.createCustomerTransaction({
        customerId,
        type,
        amount: data.amount,
        description: data.description,
        createdById: data.createdById,
        orderId: data.orderId,
        proofImage: data.proofImage
    })
}

export const deleteTransaction = customerTransactionService.deleteCustomerTransaction
export const listTransactions = customerTransactionService.listCustomerTransactions
export const listTodayTransactions = customerTransactionService.listTodayCustomerTransactions
