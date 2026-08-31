// @ts-nocheck
import { eq } from 'drizzle-orm'
import { customerTransactions, restockOrders, supplierTransactions } from '../models/tables.js'

/** Invoice charge and cash refunds leave the factory (Out). Payments and credits come in. */
export function customerTransactionDirection(type: string) {
    return type === 'order' || type === 'refund' ? 'out' : 'in'
}

export function computeCustomerNet(transactions: Array<{ type?: string | null; amount?: number | null }>) {
    let totalIn = 0
    let totalOut = 0
    for (const txn of transactions) {
        const amount = txn.amount ?? 0
        if (customerTransactionDirection(txn.type ?? '') === 'out') totalOut += amount
        else totalIn += amount
    }
    return totalIn - totalOut
}

/** Amount the customer still owes (receivable). Credit balances are 0 here. */
export function computeCustomerOwed(transactions: Array<{ type?: string | null; amount?: number | null }>) {
    return Math.max(0, -computeCustomerNet(transactions))
}

export async function loadCustomerOwed(
    dbConn: { select: typeof import('../utils/db.js').db.select },
    customerId: string
) {
    const rows = await dbConn
        .select({ type: customerTransactions.type, amount: customerTransactions.amount })
        .from(customerTransactions)
        .where(eq(customerTransactions.customerId, customerId))
    return computeCustomerOwed(rows)
}

export async function loadSupplierPayable(
    dbConn: { select: typeof import('../utils/db.js').db.select },
    supplierId: string
) {
    const [orderRows, txnRows] = await Promise.all([
        dbConn
            .select({
                status: restockOrders.status,
                totalAmount: restockOrders.totalAmount,
                amountPaid: restockOrders.amountPaid
            })
            .from(restockOrders)
            .where(eq(restockOrders.supplierId, supplierId)),
        dbConn
            .select({
                restockOrderId: supplierTransactions.restockOrderId,
                type: supplierTransactions.type,
                amount: supplierTransactions.amount
            })
            .from(supplierTransactions)
            .where(eq(supplierTransactions.supplierId, supplierId))
    ])
    return computeSupplierPayable(orderRows, standaloneSupplierNet(txnRows))
}

export function orderOutstanding(price: number, discount: number, paid: number, charges = 0, refunded = 0) {
    return Math.max(Math.max(price + charges - discount, 0) - paid + refunded, 0)
}

/** Unpaid remainder on a received restock order. Draft/ordered/cancelled do not create payable yet. */
export function restockOrderOutstanding(order: {
    status?: string | null
    totalAmount?: number | null
    amountPaid?: number | null
}) {
    if (order.status !== 'received') return 0
    return Math.max(0, (order.totalAmount ?? 0) - (order.amountPaid ?? 0))
}

/** Standalone payable In minus Out. Linked restock purchase/return/payment rows are ignored (order totals drive that side). */
export function standaloneSupplierNet(
    transactions: Array<{ restockOrderId?: string | null; type?: string | null; amount?: number | null }>
) {
    let net = 0
    for (const txn of transactions) {
        if (txn.restockOrderId) continue
        const amount = txn.amount ?? 0
        if (txn.type === 'refund' || txn.type === 'purchase') net += amount
        else net -= amount
    }
    return net
}

/** Factory still owes: unpaid received restocks + standalone In − standalone Out. */
export function computeSupplierPayable(
    orders: Array<{ status?: string | null; totalAmount?: number | null; amountPaid?: number | null }>,
    standaloneNet = 0
) {
    const restockOutstanding = orders.reduce((sum, order) => sum + restockOrderOutstanding(order), 0)
    return Math.max(0, restockOutstanding + (standaloneNet ?? 0))
}
