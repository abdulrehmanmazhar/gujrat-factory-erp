// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { supplierTransactions, suppliers } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export type SupplierTransactionType = 'payment' | 'refund'

export async function createSupplierTransaction(data: {
    supplierId: string
    type: SupplierTransactionType
    amount: number
    description: string
    createdById: string
    restockOrderId?: string
}) {
    const [transaction] = await db
        .insert(supplierTransactions)
        .values({
            id: createId(),
            supplierId: data.supplierId,
            restockOrderId: data.restockOrderId,
            type: data.type,
            amount: data.amount,
            description: data.description,
            createdById: data.createdById
        })
        .returning()

    return withLegacyId(transaction)
}

export async function listSupplierTransactions(restockOrderId?: string, limit?: number) {
    const baseQuery = restockOrderId
        ? db
              .select()
              .from(supplierTransactions)
              .where(eq(supplierTransactions.restockOrderId, restockOrderId))
              .orderBy(desc(supplierTransactions.createdAt))
        : db.select().from(supplierTransactions).orderBy(desc(supplierTransactions.createdAt))

    const rows = typeof limit === 'number' ? await baseQuery.limit(limit) : await baseQuery

    return Promise.all(
        rows.map(async (txn) => {
            const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, txn.supplierId)).limit(1)
            return {
                ...withLegacyId(txn),
                supplier: supplier ? withLegacyId(supplier) : null
            }
        })
    )
}

export async function listRecentSupplierTransactions(limit = 10) {
    return listSupplierTransactions(undefined, limit)
}

export async function deleteSupplierTransaction(id: string) {
    const [txn] = await db.select().from(supplierTransactions).where(eq(supplierTransactions.id, id)).limit(1)
    if (!txn) throw new AppError('Supplier transaction not found', 404)
    await db.delete(supplierTransactions).where(eq(supplierTransactions.id, id))
}
