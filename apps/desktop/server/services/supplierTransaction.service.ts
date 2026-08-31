// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { restockOrders, supplierTransactions, suppliers } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { deleteRemoteFile } from '../utils/rclone.js'

/** purchase = goods received (payable In); return = goods returned (payable Out); payment = cash Out; refund = standalone payable In / cash back trail. */
export type SupplierTransactionType = 'purchase' | 'return' | 'payment' | 'refund'

export async function createSupplierTransaction(data: {
    supplierId: string
    type: SupplierTransactionType
    amount: number
    description: string
    createdById: string
    restockOrderId?: string
    paymentMode?: string
    proofImage?: string
    proofImagePublicId?: string
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
            createdById: data.createdById,
            paymentMode: data.paymentMode ?? 'cash',
            proofImage: data.proofImage,
            proofImagePublicId: data.proofImagePublicId
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

    await db.transaction(async (tx) => {
        if (txn.restockOrderId) {
            if (txn.type === 'purchase') {
                throw new AppError('Goods-received rows cannot be deleted here. Cancel or delete the restock order instead.', 400)
            }
            if (txn.type === 'return') {
                throw new AppError('Goods-returned rows cannot be deleted here. Use restock return flows instead.', 400)
            }
            const [order] = await tx.select().from(restockOrders).where(eq(restockOrders.id, txn.restockOrderId)).limit(1)
            if (order && txn.type === 'payment') {
                await tx
                    .update(restockOrders)
                    .set({ amountPaid: Math.max(0, (order.amountPaid ?? 0) - txn.amount), updatedAt: new Date() })
                    .where(eq(restockOrders.id, order.id))
            } else if (order && txn.type === 'refund') {
                await tx
                    .update(restockOrders)
                    .set({ amountRefunded: Math.max(0, (order.amountRefunded ?? 0) - txn.amount), updatedAt: new Date() })
                    .where(eq(restockOrders.id, order.id))
            }
        }

        await tx.delete(supplierTransactions).where(eq(supplierTransactions.id, id))
    })

    if (txn.proofImagePublicId) {
        await deleteRemoteFile(txn.proofImagePublicId)
    }
}
