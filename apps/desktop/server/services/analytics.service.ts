// @ts-nocheck
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../utils/db.js'
import {
    customerTransactions,
    labourProductionEntries,
    labourerTransactions,
    productStockHistory,
    products,
    supplierTransactions
} from '../models/tables.js'
import { AppError } from '../utils/errors.js'

export function parseDateRange(startDate?: string, endDate?: string) {
    if (!startDate || !endDate) throw new AppError('startDate and endDate are required', 400)
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new AppError('Invalid date range', 400)
    }
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    if (start > end) throw new AppError('startDate must be before endDate', 400)
    return { start, end }
}

function groupByDay(rows: Array<{ date: Date; amount: number }>) {
    const map = new Map<string, number>()
    for (const row of rows) {
        const key = row.date.toISOString().slice(0, 10)
        map.set(key, (map.get(key) ?? 0) + row.amount)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }))
}

export async function getRevenueChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)
    const rows = await db
        .select({ createdAt: customerTransactions.createdAt, amount: customerTransactions.amount })
        .from(customerTransactions)
        .where(and(eq(customerTransactions.type, 'sale'), gte(customerTransactions.createdAt, start), lte(customerTransactions.createdAt, end)))

    return {
        series: groupByDay(rows.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0 }))),
        total: rows.reduce((s, r) => s + (r.amount ?? 0), 0)
    }
}

export async function getLabourSalariesChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)

    const productionRows = await db
        .select({ createdAt: labourProductionEntries.createdAt, amount: labourProductionEntries.totalPay })
        .from(labourProductionEntries)
        .where(and(gte(labourProductionEntries.createdAt, start), lte(labourProductionEntries.createdAt, end)))

    const paymentRows = await db
        .select({ createdAt: labourerTransactions.createdAt, amount: labourerTransactions.amount })
        .from(labourerTransactions)
        .where(and(gte(labourerTransactions.createdAt, start), lte(labourerTransactions.createdAt, end)))

    const combined = [
        ...productionRows.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0 })),
        ...paymentRows.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0 }))
    ]

    return {
        series: groupByDay(combined),
        total: combined.reduce((s, r) => s + r.amount, 0)
    }
}

export async function getExpensesChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)

    const supplierRows = await db
        .select({ createdAt: supplierTransactions.createdAt, amount: supplierTransactions.amount, type: supplierTransactions.type })
        .from(supplierTransactions)
        .where(and(gte(supplierTransactions.createdAt, start), lte(supplierTransactions.createdAt, end)))

    const labourRows = await db
        .select({ createdAt: labourerTransactions.createdAt, amount: labourerTransactions.amount })
        .from(labourerTransactions)
        .where(and(gte(labourerTransactions.createdAt, start), lte(labourerTransactions.createdAt, end)))

    const productionPay = await db
        .select({ createdAt: labourProductionEntries.createdAt, amount: labourProductionEntries.totalPay })
        .from(labourProductionEntries)
        .where(and(gte(labourProductionEntries.createdAt, start), lte(labourProductionEntries.createdAt, end)))

    const supplierExpenses = supplierRows
        .filter((r) => r.type === 'payment')
        .map((r) => ({ date: r.createdAt, amount: r.amount ?? 0, category: 'supplier' as const }))

    const labourExpenses = [
        ...labourRows.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0, category: 'labour' as const })),
        ...productionPay.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0, category: 'labour_production' as const }))
    ]

    const all = [...supplierExpenses, ...labourExpenses]
    return {
        series: groupByDay(all.map((r) => ({ date: r.date, amount: r.amount }))),
        total: all.reduce((s, r) => s + r.amount, 0),
        breakdown: {
            supplier: supplierExpenses.reduce((s, r) => s + r.amount, 0),
            labour: labourExpenses.reduce((s, r) => s + r.amount, 0)
        }
    }
}

export async function getStockMovementChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)

    const history = await db
        .select({
            recordedAt: productStockHistory.recordedAt,
            qty: productStockHistory.qty,
            productId: productStockHistory.productId
        })
        .from(productStockHistory)
        .where(and(gte(productStockHistory.recordedAt, start), lte(productStockHistory.recordedAt, end)))
        .orderBy(productStockHistory.recordedAt)

    const inbound = history.filter((h) => h.qty > 0)
    const series = groupByDay(inbound.map((h) => ({ date: h.recordedAt, amount: h.qty })))

    const productIds = [...new Set(history.map((h) => h.productId))]
    const productList =
        productIds.length > 0 ? await db.select({ id: products.id, name: products.name, stockQty: products.stockQty }).from(products) : []

    return {
        series,
        totalInbound: inbound.reduce((s, h) => s + h.qty, 0),
        currentStockTotal: productList.reduce((s, p) => s + p.stockQty, 0)
    }
}

export async function getAnalyticsDetail(report: string, startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)

    switch (report) {
        case 'revenue':
            return db
                .select()
                .from(customerTransactions)
                .where(
                    and(eq(customerTransactions.type, 'sale'), gte(customerTransactions.createdAt, start), lte(customerTransactions.createdAt, end))
                )
                .orderBy(desc(customerTransactions.createdAt))
        case 'labour':
            return db
                .select()
                .from(labourProductionEntries)
                .where(and(gte(labourProductionEntries.createdAt, start), lte(labourProductionEntries.createdAt, end)))
                .orderBy(desc(labourProductionEntries.createdAt))
        case 'expenses-supplier':
            return db
                .select()
                .from(supplierTransactions)
                .where(
                    and(
                        eq(supplierTransactions.type, 'payment'),
                        gte(supplierTransactions.createdAt, start),
                        lte(supplierTransactions.createdAt, end)
                    )
                )
                .orderBy(desc(supplierTransactions.createdAt))
        case 'expenses-labour':
            return db
                .select()
                .from(labourerTransactions)
                .where(and(gte(labourerTransactions.createdAt, start), lte(labourerTransactions.createdAt, end)))
                .orderBy(desc(labourerTransactions.createdAt))
        case 'stock-history':
            return db
                .select({
                    id: productStockHistory.id,
                    productId: productStockHistory.productId,
                    productName: products.name,
                    qty: productStockHistory.qty,
                    purchasePrice: productStockHistory.purchasePrice,
                    recordedAt: productStockHistory.recordedAt
                })
                .from(productStockHistory)
                .innerJoin(products, eq(productStockHistory.productId, products.id))
                .where(and(gte(productStockHistory.recordedAt, start), lte(productStockHistory.recordedAt, end)))
                .orderBy(desc(productStockHistory.recordedAt))
        default:
            throw new AppError('Unknown report type', 400)
    }
}

export async function getHomeSummary(startDate: string, endDate: string) {
    const [revenue, labour, expenses, stock] = await Promise.all([
        getRevenueChart(startDate, endDate),
        getLabourSalariesChart(startDate, endDate),
        getExpensesChart(startDate, endDate),
        getStockMovementChart(startDate, endDate)
    ])

    return { revenue, labour, expenses, stock }
}
