// @ts-nocheck
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '../utils/db.js'
import {
    customerTransactions,
    customers,
    inventoryBatchAllocations,
    labourProductionConsumption,
    labourProductionEntries,
    labourerTransactions,
    labourers,
    miscellaneousExpenditures,
    orderItems,
    orders,
    productCategories,
    productStockHistory,
    products,
    restockOrderItems,
    restockOrders,
    supplierTransactions,
    suppliers,
    units
} from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { computeCustomerOwed, computeSupplierPayable, customerTransactionDirection, orderOutstanding, restockOrderOutstanding, standaloneSupplierNet } from '../utils/ledger.js'
import { withLegacyId } from '../utils/mappers.js'

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

function eachDay(start: Date, end: Date) {
    const days: string[] = []
    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)
    const last = new Date(end)
    last.setHours(0, 0, 0, 0)
    while (cursor <= last) {
        days.push(cursor.toISOString().slice(0, 10))
        cursor.setDate(cursor.getDate() + 1)
    }
    return days
}

function dayEnd(dateKey: string) {
    const date = new Date(dateKey)
    date.setHours(23, 59, 59, 999)
    return date
}

export async function getProfitLossChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)

    const [sales, allocations, labourRows, miscRows] = await Promise.all([
        db
            .select({ createdAt: customerTransactions.createdAt, amount: customerTransactions.amount })
            .from(customerTransactions)
            .where(and(eq(customerTransactions.type, 'sale'), gte(customerTransactions.createdAt, start), lte(customerTransactions.createdAt, end))),
        db
            .select({
                createdAt: inventoryBatchAllocations.createdAt,
                qty: inventoryBatchAllocations.qty,
                unitCost: inventoryBatchAllocations.unitCost,
                reason: inventoryBatchAllocations.reason
            })
            .from(inventoryBatchAllocations)
            .where(
                and(
                    inArray(inventoryBatchAllocations.reason, ['sale', 'restore']),
                    gte(inventoryBatchAllocations.createdAt, start),
                    lte(inventoryBatchAllocations.createdAt, end)
                )
            ),
        db
            .select({ createdAt: labourerTransactions.createdAt, amount: labourerTransactions.amount })
            .from(labourerTransactions)
            .where(and(gte(labourerTransactions.createdAt, start), lte(labourerTransactions.createdAt, end))),
        db
            .select({ createdAt: miscellaneousExpenditures.createdAt, amount: miscellaneousExpenditures.amount })
            .from(miscellaneousExpenditures)
            .where(and(gte(miscellaneousExpenditures.createdAt, start), lte(miscellaneousExpenditures.createdAt, end)))
    ])

    const revenueByDay = groupByDay(sales.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0 })))
    const cogsByDay = groupByDay(
        allocations.map((row) => ({
            date: row.createdAt,
            amount: (row.qty ?? 0) * (row.unitCost ?? 0)
        }))
    )
    const labourByDay = groupByDay(labourRows.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0 })))
    const miscByDay = groupByDay(miscRows.map((r) => ({ date: r.createdAt, amount: r.amount ?? 0 })))

    const mapFrom = (series: Array<{ date: string; total: number }>) => new Map(series.map((row) => [row.date, row.total]))
    const revenueMap = mapFrom(revenueByDay)
    const cogsMap = mapFrom(cogsByDay)
    const labourMap = mapFrom(labourByDay)
    const miscMap = mapFrom(miscByDay)

    const series = eachDay(start, end).map((date) => {
        const revenue = revenueMap.get(date) ?? 0
        const cogs = cogsMap.get(date) ?? 0
        const labour = labourMap.get(date) ?? 0
        const misc = miscMap.get(date) ?? 0
        return {
            date,
            total: revenue - cogs - labour - misc,
            revenue,
            cogs,
            labour,
            misc
        }
    })

    return {
        series: series.map(({ date, total }) => ({ date, total })),
        total: series.reduce((sum, row) => sum + row.total, 0),
        sales: {
            series: eachDay(start, end).map((date) => ({ date, total: revenueMap.get(date) ?? 0 })),
            total: series.reduce((sum, row) => sum + row.revenue, 0)
        },
        cogs: {
            series: eachDay(start, end).map((date) => ({ date, total: cogsMap.get(date) ?? 0 })),
            total: series.reduce((sum, row) => sum + row.cogs, 0)
        },
        labour: {
            series: eachDay(start, end).map((date) => ({ date, total: labourMap.get(date) ?? 0 })),
            total: series.reduce((sum, row) => sum + row.labour, 0)
        },
        misc: {
            series: eachDay(start, end).map((date) => ({ date, total: miscMap.get(date) ?? 0 })),
            total: series.reduce((sum, row) => sum + row.misc, 0)
        },
        breakdown: {
            revenue: series.reduce((sum, row) => sum + row.revenue, 0),
            cogs: series.reduce((sum, row) => sum + row.cogs, 0),
            labour: series.reduce((sum, row) => sum + row.labour, 0),
            misc: series.reduce((sum, row) => sum + row.misc, 0)
        }
    }
}

export async function getTotalExpensesChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)

    const [supplierRows, labourRows, miscRows] = await Promise.all([
        db
            .select({ createdAt: supplierTransactions.createdAt, amount: supplierTransactions.amount, type: supplierTransactions.type })
            .from(supplierTransactions)
            .where(and(gte(supplierTransactions.createdAt, start), lte(supplierTransactions.createdAt, end))),
        db
            .select({ createdAt: labourerTransactions.createdAt, amount: labourerTransactions.amount })
            .from(labourerTransactions)
            .where(and(gte(labourerTransactions.createdAt, start), lte(labourerTransactions.createdAt, end))),
        db
            .select({ createdAt: miscellaneousExpenditures.createdAt, amount: miscellaneousExpenditures.amount })
            .from(miscellaneousExpenditures)
            .where(and(gte(miscellaneousExpenditures.createdAt, start), lte(miscellaneousExpenditures.createdAt, end)))
    ])

    const supplierExpenses = supplierRows
        .filter((row) => row.type === 'payment')
        .map((row) => ({ date: row.createdAt, amount: row.amount ?? 0 }))
    const labourExpenses = labourRows.map((row) => ({ date: row.createdAt, amount: row.amount ?? 0 }))
    const miscExpenses = miscRows.map((row) => ({ date: row.createdAt, amount: row.amount ?? 0 }))
    const all = [...supplierExpenses, ...labourExpenses, ...miscExpenses]

    return {
        series: groupByDay(all),
        total: all.reduce((sum, row) => sum + row.amount, 0),
        breakdown: {
            supplier: supplierExpenses.reduce((sum, row) => sum + row.amount, 0),
            labour: labourExpenses.reduce((sum, row) => sum + row.amount, 0),
            misc: miscExpenses.reduce((sum, row) => sum + row.amount, 0)
        }
    }
}

export async function getSupplierLiabilitiesChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)
    const [orderRows, txnRows] = await Promise.all([
        db.select().from(restockOrders),
        db.select().from(supplierTransactions)
    ])

    const series = eachDay(start, end).map((dateKey) => {
        const asOf = dayEnd(dateKey)
        const ordersAsOf = orderRows
            .filter((order) => order.status === 'received' && order.receivedAt && order.receivedAt <= asOf)
            .map((order) => {
                const paid = txnRows
                    .filter(
                        (txn) =>
                            txn.restockOrderId === order.id &&
                            txn.type === 'payment' &&
                            txn.createdAt &&
                            txn.createdAt <= asOf
                    )
                    .reduce((sum, txn) => sum + (txn.amount ?? 0), 0)
                return {
                    status: order.status,
                    totalAmount: order.totalAmount,
                    amountPaid: paid
                }
            })
        const standalone = standaloneSupplierNet(
            txnRows.filter((txn) => !txn.restockOrderId && txn.createdAt && txn.createdAt <= asOf)
        )
        return {
            date: dateKey,
            total: computeSupplierPayable(ordersAsOf, standalone)
        }
    })

    return {
        series,
        total: series.length ? series[series.length - 1].total : 0
    }
}

export async function getCustomerUdharChart(startDate: string, endDate: string) {
    const { start, end } = parseDateRange(startDate, endDate)
    const txnRows = await db
        .select({
            customerId: customerTransactions.customerId,
            type: customerTransactions.type,
            amount: customerTransactions.amount,
            createdAt: customerTransactions.createdAt
        })
        .from(customerTransactions)

    const series = eachDay(start, end).map((dateKey) => {
        const asOf = dayEnd(dateKey)
        const owedByCustomer = new Map()
        for (const txn of txnRows) {
            if (!txn.createdAt || txn.createdAt > asOf) continue
            const list = owedByCustomer.get(txn.customerId) ?? []
            list.push(txn)
            owedByCustomer.set(txn.customerId, list)
        }
        let total = 0
        for (const txns of owedByCustomer.values()) {
            total += computeCustomerOwed(txns)
        }
        return { date: dateKey, total }
    })

    return {
        series,
        total: series.length ? series[series.length - 1].total : 0
    }
}

export async function getHomeSummary(startDate: string, endDate: string) {
    const [profitLoss, expenses, liabilities, customerUdhar] = await Promise.all([
        getProfitLossChart(startDate, endDate),
        getTotalExpensesChart(startDate, endDate),
        getSupplierLiabilitiesChart(startDate, endDate),
        getCustomerUdharChart(startDate, endDate)
    ])

    return {
        profitLoss,
        sales: profitLoss.sales,
        cogs: profitLoss.cogs,
        labourCost: profitLoss.labour,
        miscCost: profitLoss.misc,
        expenses,
        liabilities,
        customerUdhar
    }
}

function parseOptionalBound(value?: string, endOfDay = false) {
    if (!value?.trim()) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) throw new AppError('Invalid date', 400)
    if (endOfDay) date.setHours(23, 59, 59, 999)
    else date.setHours(0, 0, 0, 0)
    return date
}

function inDateRange(value: Date | string | null | undefined, from: Date | null, to: Date | null) {
    if (!from && !to) return true
    if (!value) return false
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return false
    if (from && date < from) return false
    if (to && date > to) return false
    return true
}

function transactionDirection(type: string) {
    return customerTransactionDirection(type)
}

function matchesQuery(q: string | undefined, ...values: Array<string | number | null | undefined>) {
    const needle = q?.trim().toLowerCase()
    if (!needle) return true
    return values.some((value) => value != null && String(value).toLowerCase().includes(needle))
}

function orderPayableAmount(price = 0, discount = 0, charges = 0) {
    return Math.max(price + charges - discount, 0)
}

function mapAnalyticsTransaction(row) {
    return {
        ...withLegacyId(row),
        direction: transactionDirection(row.type)
    }
}

const FINALIZED_ORDER_STATUSES = ['saved', 'cancelled', 'returned']

export async function getCustomerAnalytics(filters?: { from?: string; to?: string; q?: string }) {
    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    if (from && to && from > to) throw new AppError('From date must be before to date', 400)

    const [customerRows, orderRows, txnRows] = await Promise.all([
        db.select().from(customers).orderBy(asc(customers.name)),
        db
            .select({
                id: orders.id,
                customerId: orders.customerId,
                orderNumber: orders.orderNumber,
                price: orders.price,
                payment: orders.payment,
                refunded: orders.refunded,
                discount: orders.discount,
                charges: orders.charges,
                status: orders.status,
                createdAt: orders.createdAt
            })
            .from(orders)
            .where(inArray(orders.status, FINALIZED_ORDER_STATUSES)),
        db.select().from(customerTransactions)
    ])

    const ordersByCustomer = new Map()
    for (const order of orderRows) {
        const list = ordersByCustomer.get(order.customerId) ?? []
        list.push(order)
        ordersByCustomer.set(order.customerId, list)
    }

    const txnsByCustomer = new Map()
    for (const txn of txnRows) {
        const list = txnsByCustomer.get(txn.customerId) ?? []
        list.push(txn)
        txnsByCustomer.set(txn.customerId, list)
    }

    return customerRows.map((customer) => {
        const allOrders = ordersByCustomer.get(customer.id) ?? []
        const rangedOrders = allOrders.filter((order) => inDateRange(order.createdAt, from, to))
        const allTxns = txnsByCustomer.get(customer.id) ?? []
        const rangedTxns = allTxns.filter((txn) => inDateRange(txn.createdAt, from, to))

        let totalIn = 0
        let totalOut = 0
        for (const txn of rangedTxns) {
            if (transactionDirection(txn.type) === 'in') totalIn += txn.amount ?? 0
            else totalOut += txn.amount ?? 0
        }

        const totalSales = rangedOrders
            .filter((order) => order.status === 'saved')
            .reduce((sum, order) => sum + orderPayableAmount(order.price ?? 0, order.discount ?? 0, order.charges ?? 0), 0)

        const orderNumbers = allOrders.map((order) => order.orderNumber).filter((value) => value != null)
        const row = {
            ...withLegacyId(customer),
            owed: computeCustomerOwed(allTxns),
            orderCount: rangedOrders.length,
            totalSales,
            totalIn,
            totalOut,
            netAmount: totalIn - totalOut,
            orderNumbers
        }
        if (
            !matchesQuery(
                filters?.q,
                customer.name,
                customer.contact,
                customer.address,
                ...orderNumbers,
                ...allTxns.map((txn) => txn.description)
            )
        ) {
            return null
        }
        return row
    }).filter(Boolean)
}

export async function getCustomerAnalyticsDetail(customerId: string) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const [orderRows, txnRows] = await Promise.all([
        db
            .select({
                id: orders.id,
                customerId: orders.customerId,
                orderNumber: orders.orderNumber,
                price: orders.price,
                payment: orders.payment,
                refunded: orders.refunded,
                discount: orders.discount,
                charges: orders.charges,
                status: orders.status,
                orderMode: orders.orderMode,
                createdAt: orders.createdAt
            })
            .from(orders)
            .where(and(eq(orders.customerId, customerId), inArray(orders.status, FINALIZED_ORDER_STATUSES)))
            .orderBy(desc(orders.createdAt)),
        db.select().from(customerTransactions).where(eq(customerTransactions.customerId, customerId)).orderBy(desc(customerTransactions.createdAt))
    ])

    const txnsByOrderId = new Map()
    const standaloneTransactions = []
    for (const txn of txnRows) {
        const mapped = mapAnalyticsTransaction(txn)
        if (!txn.orderId) {
            standaloneTransactions.push(mapped)
            continue
        }
        const list = txnsByOrderId.get(txn.orderId) ?? []
        list.push(mapped)
        txnsByOrderId.set(txn.orderId, list)
    }

    return {
        customer: withLegacyId(customer),
        orders: orderRows.map((order) => {
            const payable = orderPayableAmount(order.price ?? 0, order.discount ?? 0, order.charges ?? 0)
            const isOpen = order.status === 'saved' || !order.status
            return {
                ...withLegacyId(order),
                payable,
                outstanding: isOpen
                    ? orderOutstanding(order.price ?? 0, order.discount ?? 0, order.payment ?? 0, order.charges ?? 0, order.refunded ?? 0)
                    : 0,
                transactions: txnsByOrderId.get(order.id) ?? []
            }
        }),
        standaloneTransactions
    }
}

/** Payable book: purchase/refund raise what we owe (In); payment/return reduce it (Out). */
function supplierTransactionDirection(type: string) {
    return type === 'purchase' || type === 'refund' ? 'in' : 'out'
}

function mapSupplierAnalyticsTransaction(row) {
    return {
        ...withLegacyId(row),
        direction: supplierTransactionDirection(row.type)
    }
}

const LISTED_RESTOCK_STATUSES = ['ordered', 'received', 'cancelled']

export async function getSupplierAnalytics(filters?: { from?: string; to?: string; q?: string }) {
    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    if (from && to && from > to) throw new AppError('From date must be before to date', 400)

    const [supplierRows, orderRows, txnRows] = await Promise.all([
        db.select().from(suppliers).orderBy(asc(suppliers.name)),
        db
            .select({
                id: restockOrders.id,
                supplierId: restockOrders.supplierId,
                referenceNumber: restockOrders.referenceNumber,
                status: restockOrders.status,
                totalAmount: restockOrders.totalAmount,
                amountPaid: restockOrders.amountPaid,
                amountRefunded: restockOrders.amountRefunded,
                createdAt: restockOrders.createdAt
            })
            .from(restockOrders)
            .where(inArray(restockOrders.status, LISTED_RESTOCK_STATUSES)),
        db.select().from(supplierTransactions)
    ])

    const ordersBySupplier = new Map()
    for (const order of orderRows) {
        const list = ordersBySupplier.get(order.supplierId) ?? []
        list.push(order)
        ordersBySupplier.set(order.supplierId, list)
    }

    const txnsBySupplier = new Map()
    for (const txn of txnRows) {
        const list = txnsBySupplier.get(txn.supplierId) ?? []
        list.push(txn)
        txnsBySupplier.set(txn.supplierId, list)
    }

    return supplierRows.map((supplier) => {
        const allOrders = ordersBySupplier.get(supplier.id) ?? []
        const rangedOrders = allOrders.filter((order) => inDateRange(order.createdAt, from, to))
        const allTxns = txnsBySupplier.get(supplier.id) ?? []
        const rangedTxns = allTxns.filter((txn) => inDateRange(txn.createdAt, from, to))

        let totalIn = 0
        let totalOut = 0
        for (const txn of rangedTxns) {
            if (supplierTransactionDirection(txn.type) === 'in') totalIn += txn.amount ?? 0
            else totalOut += txn.amount ?? 0
        }

        const totalPurchases = rangedOrders
            .filter((order) => order.status === 'received')
            .reduce((sum, order) => sum + (order.totalAmount ?? 0), 0)

        const restockOutstanding = allOrders.reduce((sum, order) => sum + restockOrderOutstanding(order), 0)
        const referenceNumbers = allOrders.map((order) => order.referenceNumber).filter((value) => Boolean(value))
        const row = {
            ...withLegacyId(supplier),
            payable: computeSupplierPayable(allOrders, standaloneSupplierNet(allTxns)),
            orderCount: rangedOrders.length,
            totalPurchases,
            restockOutstanding,
            totalIn,
            totalOut,
            netAmount: totalIn - totalOut,
            referenceNumbers
        }
        if (
            !matchesQuery(
                filters?.q,
                supplier.name,
                supplier.contact,
                supplier.businessName,
                supplier.address,
                ...referenceNumbers,
                ...allTxns.map((txn) => txn.description)
            )
        ) {
            return null
        }
        return row
    }).filter(Boolean)
}

export async function getSupplierAnalyticsDetail(supplierId: string) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
    if (!supplier) throw new AppError('Supplier not found', 404)

    const [orderRows, txnRows] = await Promise.all([
        db
            .select()
            .from(restockOrders)
            .where(and(eq(restockOrders.supplierId, supplierId), inArray(restockOrders.status, LISTED_RESTOCK_STATUSES)))
            .orderBy(desc(restockOrders.createdAt)),
        db.select().from(supplierTransactions).where(eq(supplierTransactions.supplierId, supplierId)).orderBy(desc(supplierTransactions.createdAt))
    ])

    const orderIds = orderRows.map((order) => order.id)
    const itemRows = orderIds.length
        ? await db
              .select({ item: restockOrderItems, product: products })
              .from(restockOrderItems)
              .innerJoin(products, eq(restockOrderItems.productId, products.id))
              .where(inArray(restockOrderItems.restockOrderId, orderIds))
        : []

    const itemsByOrderId = new Map()
    for (const { item, product } of itemRows) {
        const list = itemsByOrderId.get(item.restockOrderId) ?? []
        list.push({
            ...withLegacyId(item),
            product: withLegacyId(product)
        })
        itemsByOrderId.set(item.restockOrderId, list)
    }

    const txnsByOrderId = new Map()
    const standaloneTransactions = []
    for (const txn of txnRows) {
        const mapped = mapSupplierAnalyticsTransaction(txn)
        if (!txn.restockOrderId) {
            standaloneTransactions.push(mapped)
            continue
        }
        const list = txnsByOrderId.get(txn.restockOrderId) ?? []
        list.push(mapped)
        txnsByOrderId.set(txn.restockOrderId, list)
    }

    return {
        supplier: {
            ...withLegacyId(supplier),
            payable: computeSupplierPayable(orderRows, standaloneSupplierNet(txnRows))
        },
        orders: orderRows.map((order) => ({
            ...withLegacyId(order),
            outstanding: restockOrderOutstanding(order),
            items: itemsByOrderId.get(order.id) ?? [],
            transactions: txnsByOrderId.get(order.id) ?? []
        })),
        standaloneTransactions
    }
}

function labourTransactionDirection(category: string) {
    return category === 'production' || category === 'income' ? 'in' : 'out'
}

function mapLabourAnalyticsTransaction(row) {
    return {
        ...withLegacyId(row),
        labourCategory: row.category,
        direction: labourTransactionDirection(row.category)
    }
}

export async function getLabourAnalytics(filters?: { from?: string; to?: string; q?: string }) {
    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    if (from && to && from > to) throw new AppError('From date must be before to date', 400)

    const [labourerRows, entryRows, txnRows, productRows] = await Promise.all([
        db.select().from(labourers).orderBy(asc(labourers.name)),
        db
            .select({
                id: labourProductionEntries.id,
                labourerId: labourProductionEntries.labourerId,
                productId: labourProductionEntries.productId,
                totalPay: labourProductionEntries.totalPay,
                notes: labourProductionEntries.notes,
                createdAt: labourProductionEntries.createdAt
            })
            .from(labourProductionEntries),
        db.select().from(labourerTransactions),
        db.select({ id: products.id, name: products.name }).from(products)
    ])

    const productNameById = new Map(productRows.map((product) => [product.id, product.name]))

    const entriesByLabourer = new Map()
    for (const entry of entryRows) {
        const list = entriesByLabourer.get(entry.labourerId) ?? []
        list.push(entry)
        entriesByLabourer.set(entry.labourerId, list)
    }

    const txnsByLabourer = new Map()
    for (const txn of txnRows) {
        const list = txnsByLabourer.get(txn.labourerId) ?? []
        list.push(txn)
        txnsByLabourer.set(txn.labourerId, list)
    }

    return labourerRows.map((labourer) => {
        const allEntries = entriesByLabourer.get(labourer.id) ?? []
        const allTxns = txnsByLabourer.get(labourer.id) ?? []
        const rangedEntries = allEntries.filter((entry) => inDateRange(entry.createdAt, from, to))
        const rangedTxns = allTxns.filter((txn) => inDateRange(txn.createdAt, from, to))

        let totalIn = 0
        let totalOut = 0
        for (const txn of rangedTxns) {
            if (labourTransactionDirection(txn.category) === 'in') totalIn += txn.amount ?? 0
            else totalOut += txn.amount ?? 0
        }

        const totalProductionPay = rangedEntries.reduce((sum, entry) => sum + (entry.totalPay ?? 0), 0)
        const productNames = [...new Set(allEntries.map((entry) => productNameById.get(entry.productId)).filter((name) => Boolean(name)))]

        const row = {
            ...withLegacyId(labourer),
            productionCount: rangedEntries.length,
            totalProductionPay,
            totalIn,
            totalOut,
            netAmount: totalIn - totalOut,
            productNames
        }
        if (
            !matchesQuery(
                filters?.q,
                labourer.name,
                labourer.contact,
                labourer.notes,
                ...productNames,
                ...allTxns.map((txn) => txn.description),
                ...allEntries.map((entry) => entry.notes)
            )
        ) {
            return null
        }
        return row
    }).filter(Boolean)
}

export async function getLabourAnalyticsDetail(labourerId: string) {
    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, labourerId)).limit(1)
    if (!labourer) throw new AppError('Labourer not found', 404)

    const [entryRows, txnRows] = await Promise.all([
        db
            .select()
            .from(labourProductionEntries)
            .where(eq(labourProductionEntries.labourerId, labourerId))
            .orderBy(desc(labourProductionEntries.createdAt)),
        db.select().from(labourerTransactions).where(eq(labourerTransactions.labourerId, labourerId)).orderBy(desc(labourerTransactions.createdAt))
    ])

    const productIds = [...new Set(entryRows.map((entry) => entry.productId))]
    const productList = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : []
    const productById = new Map(productList.map((product) => [product.id, product]))

    const entryIds = entryRows.map((entry) => entry.id)
    const consumptionRows = entryIds.length
        ? await db
              .select({ row: labourProductionConsumption, product: products })
              .from(labourProductionConsumption)
              .innerJoin(products, eq(labourProductionConsumption.productId, products.id))
              .where(inArray(labourProductionConsumption.entryId, entryIds))
        : []

    const consumptionByEntryId = new Map()
    for (const { row, product } of consumptionRows) {
        const list = consumptionByEntryId.get(row.entryId) ?? []
        list.push({
            ...withLegacyId(row),
            product: withLegacyId(product)
        })
        consumptionByEntryId.set(row.entryId, list)
    }

    const txnById = new Map(txnRows.map((txn) => [txn.id, mapLabourAnalyticsTransaction(txn)]))
    const linkedTxnIds = new Set(entryRows.map((entry) => entry.labourerTransactionId).filter(Boolean))
    const standaloneTransactions = txnRows.filter((txn) => !linkedTxnIds.has(txn.id)).map(mapLabourAnalyticsTransaction)

    return {
        labourer: withLegacyId(labourer),
        productions: entryRows.map((entry) => {
            const product = productById.get(entry.productId)
            const linkedTxn = entry.labourerTransactionId ? txnById.get(entry.labourerTransactionId) : null
            return {
                ...withLegacyId(entry),
                product: product ? withLegacyId(product) : null,
                consumption: consumptionByEntryId.get(entry.id) ?? [],
                transactions: linkedTxn ? [linkedTxn] : []
            }
        }),
        standaloneTransactions
    }
}

function mapProductMeta(productRows, unitRows, linkRows) {
    const unitById = new Map(unitRows.map((unit) => [unit.id, unit]))
    const categoryIdsByProduct = new Map()
    for (const link of linkRows) {
        const list = categoryIdsByProduct.get(link.productId) ?? []
        list.push(link.categoryId)
        categoryIdsByProduct.set(link.productId, list)
    }
    const productById = new Map(productRows.map((product) => [product.id, product]))
    return { unitById, categoryIdsByProduct, productById }
}

function inventoryProductLine(productId, agg, meta) {
    const product = meta.productById.get(productId)
    const unit = product ? meta.unitById.get(product.unitId) : null
    return {
        productId,
        name: product?.name ?? 'Unknown',
        category: product?.category ?? '',
        categoryIds: meta.categoryIdsByProduct.get(productId) ?? [],
        unitName: unit?.name ?? 'pcs',
        qty: agg.qty,
        value: agg.value,
        orderCount: agg.orderIds?.size ?? agg.entryCount ?? 0
    }
}

export async function getInventoryCustomerAnalytics(filters?: { from?: string; to?: string }) {
    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    if (from && to && from > to) throw new AppError('From date must be before to date', 400)

    const [customerRows, orderRows, itemRows, productRows, unitRows, linkRows] = await Promise.all([
        db.select().from(customers).orderBy(asc(customers.name)),
        db
            .select({
                id: orders.id,
                customerId: orders.customerId,
                status: orders.status,
                returnedAt: orders.returnedAt,
                createdAt: orders.createdAt
            })
            .from(orders),
        db.select().from(orderItems),
        db.select().from(products),
        db.select().from(units),
        db.select().from(productCategories)
    ])

    const soldOrderIds = new Set(
        orderRows
            .filter((order) => order.status === 'saved' && !order.returnedAt && inDateRange(order.createdAt, from, to))
            .map((order) => order.id)
    )
    const orderById = new Map(orderRows.map((order) => [order.id, order]))
    const meta = mapProductMeta(productRows, unitRows, linkRows)
    const byCustomer = new Map()

    for (const item of itemRows) {
        if (!soldOrderIds.has(item.orderId)) continue
        const order = orderById.get(item.orderId)
        if (!order) continue
        const productMap = byCustomer.get(order.customerId) ?? new Map()
        const existing = productMap.get(item.productId) ?? { qty: 0, value: 0, orderIds: new Set() }
        existing.qty += item.qty ?? 0
        existing.value += ((item.unitPrice ?? 0) - (item.unitDiscount ?? 0)) * (item.qty ?? 0)
        existing.orderIds.add(item.orderId)
        productMap.set(item.productId, existing)
        byCustomer.set(order.customerId, productMap)
    }

    return customerRows.map((customer) => {
        const productMap = byCustomer.get(customer.id) ?? new Map()
        const productLines = [...productMap.entries()]
            .map(([productId, agg]) => inventoryProductLine(productId, agg, meta))
            .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
        const orderIds = new Set()
        for (const agg of productMap.values()) {
            for (const orderId of agg.orderIds) orderIds.add(orderId)
        }
        return {
            ...withLegacyId(customer),
            orderCount: orderIds.size,
            productCount: productLines.length,
            totalQty: productLines.reduce((sum, row) => sum + row.qty, 0),
            totalValue: productLines.reduce((sum, row) => sum + row.value, 0),
            products: productLines
        }
    })
}

export async function getInventorySupplierAnalytics(filters?: { from?: string; to?: string }) {
    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    if (from && to && from > to) throw new AppError('From date must be before to date', 400)

    const [supplierRows, orderRows, itemRows, productRows, unitRows, linkRows] = await Promise.all([
        db.select().from(suppliers).orderBy(asc(suppliers.name)),
        db
            .select({
                id: restockOrders.id,
                supplierId: restockOrders.supplierId,
                status: restockOrders.status,
                receivedAt: restockOrders.receivedAt,
                createdAt: restockOrders.createdAt
            })
            .from(restockOrders),
        db.select().from(restockOrderItems),
        db.select().from(products),
        db.select().from(units),
        db.select().from(productCategories)
    ])

    const receivedOrderIds = new Set(
        orderRows
            .filter((order) => order.status === 'received' && inDateRange(order.receivedAt ?? order.createdAt, from, to))
            .map((order) => order.id)
    )
    const orderById = new Map(orderRows.map((order) => [order.id, order]))
    const meta = mapProductMeta(productRows, unitRows, linkRows)
    const bySupplier = new Map()

    for (const item of itemRows) {
        if (!receivedOrderIds.has(item.restockOrderId)) continue
        const order = orderById.get(item.restockOrderId)
        if (!order) continue
        const qty = Math.max(0, (item.qtyReceived ?? 0) - (item.qtyReturned ?? 0))
        const productMap = bySupplier.get(order.supplierId) ?? new Map()
        const existing = productMap.get(item.productId) ?? { qty: 0, qtyReceived: 0, qtyReturned: 0, value: 0, orderIds: new Set() }
        existing.qty += qty
        existing.qtyReceived += item.qtyReceived ?? 0
        existing.qtyReturned += item.qtyReturned ?? 0
        existing.value += qty * (item.unitCost ?? 0)
        existing.orderIds.add(item.restockOrderId)
        productMap.set(item.productId, existing)
        bySupplier.set(order.supplierId, productMap)
    }

    return supplierRows.map((supplier) => {
        const productMap = bySupplier.get(supplier.id) ?? new Map()
        const productLines = [...productMap.entries()]
            .map(([productId, agg]) => ({
                ...inventoryProductLine(productId, agg, meta),
                qtyReceived: agg.qtyReceived,
                qtyReturned: agg.qtyReturned
            }))
            .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
        const orderIds = new Set()
        for (const agg of productMap.values()) {
            for (const orderId of agg.orderIds) orderIds.add(orderId)
        }
        return {
            ...withLegacyId(supplier),
            orderCount: orderIds.size,
            productCount: productLines.length,
            totalQty: productLines.reduce((sum, row) => sum + row.qty, 0),
            totalValue: productLines.reduce((sum, row) => sum + row.value, 0),
            products: productLines
        }
    })
}

export async function getInventoryLabourAnalytics(filters?: { from?: string; to?: string }) {
    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    if (from && to && from > to) throw new AppError('From date must be before to date', 400)

    const [labourerRows, entryRows, consumptionRows, productRows, unitRows, linkRows] = await Promise.all([
        db.select().from(labourers).orderBy(asc(labourers.name)),
        db.select().from(labourProductionEntries),
        db.select().from(labourProductionConsumption),
        db.select().from(products),
        db.select().from(units),
        db.select().from(productCategories)
    ])

    const rangedEntries = entryRows.filter((entry) => inDateRange(entry.createdAt, from, to))
    const rangedEntryIds = new Set(rangedEntries.map((entry) => entry.id))
    const meta = mapProductMeta(productRows, unitRows, linkRows)
    const producedByLabourer = new Map()
    const consumedByLabourer = new Map()

    for (const entry of rangedEntries) {
        const productMap = producedByLabourer.get(entry.labourerId) ?? new Map()
        const existing = productMap.get(entry.productId) ?? { qty: 0, value: 0, entryCount: 0 }
        existing.qty += entry.qtyProduced ?? 0
        existing.value += entry.totalPay ?? 0
        existing.entryCount += 1
        productMap.set(entry.productId, existing)
        producedByLabourer.set(entry.labourerId, productMap)
    }

    const entryLabourerById = new Map(rangedEntries.map((entry) => [entry.id, entry.labourerId]))
    for (const row of consumptionRows) {
        if (!rangedEntryIds.has(row.entryId)) continue
        const labourerId = entryLabourerById.get(row.entryId)
        if (!labourerId) continue
        const productMap = consumedByLabourer.get(labourerId) ?? new Map()
        const existing = productMap.get(row.productId) ?? { qty: 0, value: 0, entryCount: 0 }
        existing.qty += row.qtyConsumed ?? 0
        existing.entryCount += 1
        productMap.set(row.productId, existing)
        consumedByLabourer.set(labourerId, productMap)
    }

    return labourerRows.map((labourer) => {
        const producedMap = producedByLabourer.get(labourer.id) ?? new Map()
        const consumedMap = consumedByLabourer.get(labourer.id) ?? new Map()
        const produced = [...producedMap.entries()]
            .map(([productId, agg]) => inventoryProductLine(productId, agg, meta))
            .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
        const consumed = [...consumedMap.entries()]
            .map(([productId, agg]) => inventoryProductLine(productId, agg, meta))
            .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
        return {
            ...withLegacyId(labourer),
            productionCount: rangedEntries.filter((entry) => entry.labourerId === labourer.id).length,
            producedQty: produced.reduce((sum, row) => sum + row.qty, 0),
            producedValue: produced.reduce((sum, row) => sum + row.value, 0),
            consumedQty: consumed.reduce((sum, row) => sum + row.qty, 0),
            productCount: produced.length,
            produced,
            consumed
        }
    })
}
