// @ts-nocheck
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { products, productStockHistory, restockOrderItems, restockOrders, supplierTransactions, suppliers } from '../models/tables.js'
import { createSupplierTransaction } from './supplierTransaction.service.js'
import { consumeInventoryFifo, createInventoryBatch, findBatchesForRestockItem } from './inventoryBatch.service.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

type RestockItemInput = { productId: string; qtyOrdered: number; unitCost: number }
type ReturnedItemInput = { itemId: string; qtyReturned: number }

async function applyRestockItemReturns(restockOrderId: string, returnedItems: ReturnedItemInput[]) {
    const order = await getRestockWithItems(restockOrderId)
    if (!order) throw new AppError('Restock order not found', 404)

    const itemMap = new Map(order.items.map((item) => [item.id, item]))
    let returnValue = 0

    for (const ret of returnedItems) {
        if (ret.qtyReturned <= 0) continue

        const item = itemMap.get(ret.itemId)
        if (!item) throw new AppError(`Restock item ${ret.itemId} not found`, 400)

        const returnable = (item.qtyReceived ?? 0) - (item.qtyReturned ?? 0)
        if (ret.qtyReturned > returnable) {
            throw new AppError(`Cannot return more than ${returnable} units for this line item`, 400)
        }

        returnValue += ret.qtyReturned * item.unitCost

        const preferred = await findBatchesForRestockItem(item.id)
        await consumeInventoryFifo(item.productId, ret.qtyReturned, {
            reason: 'return',
            restockOrderItemId: item.id,
            preferredBatchIds: preferred.map((batch) => batch.id),
            writeHistory: true,
            updateProductStock: true
        })

        await db
            .update(restockOrderItems)
            .set({ qtyReturned: (item.qtyReturned ?? 0) + ret.qtyReturned })
            .where(eq(restockOrderItems.id, item.id))
    }

    if (returnValue <= 0) throw new AppError('At least one item with a positive return quantity is required', 400)
    return returnValue
}

async function recalculateRestockOrderTotals(restockOrderId: string) {
    const items = await db.select().from(restockOrderItems).where(eq(restockOrderItems.restockOrderId, restockOrderId))

    let totalAmount = 0
    for (const item of items) {
        const netQty = Math.max(0, (item.qtyReceived ?? 0) - (item.qtyReturned ?? 0))
        const lineTotal = netQty * item.unitCost
        totalAmount += lineTotal
        await db.update(restockOrderItems).set({ lineTotal }).where(eq(restockOrderItems.id, item.id))
    }

    await db.update(restockOrders).set({ totalAmount, updatedAt: new Date() }).where(eq(restockOrders.id, restockOrderId))
    return totalAmount
}

async function getRestockWithItems(restockOrderId: string) {
    const [order] = await db.select().from(restockOrders).where(eq(restockOrders.id, restockOrderId)).limit(1)
    if (!order) return null

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId)).limit(1)
    const items = await db
        .select({ item: restockOrderItems, product: products })
        .from(restockOrderItems)
        .innerJoin(products, eq(restockOrderItems.productId, products.id))
        .where(eq(restockOrderItems.restockOrderId, restockOrderId))

    return {
        ...withLegacyId(order),
        supplier: supplier ? withLegacyId(supplier) : null,
        items: items.map(({ item, product }) => ({
            ...withLegacyId(item),
            product: withLegacyId(product)
        }))
    }
}

export async function createRestockOrder(
    supplierId: string,
    createdById: string,
    items: RestockItemInput[],
    notes?: string,
    referenceNumber?: string
) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
    if (!supplier) throw new AppError('Supplier not found', 404)
    if (!items.length) throw new AppError('At least one restock item is required', 400)

    const totalAmount = items.reduce((acc, item) => acc + item.qtyOrdered * item.unitCost, 0)
    const restockOrderId = createId()

    await db.insert(restockOrders).values({
        id: restockOrderId,
        supplierId,
        createdById,
        status: 'draft',
        totalAmount,
        notes,
        referenceNumber
    })

    for (const item of items) {
        await db.insert(restockOrderItems).values({
            id: createId(),
            restockOrderId,
            productId: item.productId,
            qtyOrdered: item.qtyOrdered,
            unitCost: item.unitCost,
            lineTotal: item.qtyOrdered * item.unitCost
        })
    }

    return getRestockWithItems(restockOrderId)
}

export async function listRestockOrders(status?: string) {
    const rows = status
        ? await db.select().from(restockOrders).where(eq(restockOrders.status, status)).orderBy(desc(restockOrders.createdAt))
        : await db.select().from(restockOrders).orderBy(desc(restockOrders.createdAt))

    return Promise.all(rows.map((row) => getRestockWithItems(row.id)))
}

export async function getRestockOrder(id: string) {
    const order = await getRestockWithItems(id)
    if (!order) throw new AppError('Restock order not found', 404)
    return order
}

export async function markRestockOrdered(id: string) {
    const [updated] = await db
        .update(restockOrders)
        .set({ status: 'ordered', orderedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(restockOrders.id, id), eq(restockOrders.status, 'draft')))
        .returning()

    if (!updated) throw new AppError('Restock order not found or not in draft status', 400)
    return getRestockWithItems(id)
}

export async function receiveRestockOrder(id: string, receivedById: string, receivedItems?: { itemId: string; qtyReceived: number }[]) {
    const order = await getRestockWithItems(id)
    if (!order) throw new AppError('Restock order not found', 404)
    if (order.status === 'received') throw new AppError('Restock order already received', 400)
    if (order.status === 'cancelled') throw new AppError('Cannot receive a cancelled restock order', 400)

    let totalReceivedAmount = 0

    for (const item of order.items) {
        const receivedQty = receivedItems?.find((r) => r.itemId === item.id)?.qtyReceived ?? item.qtyOrdered
        if (receivedQty <= 0) continue

        const lineTotal = receivedQty * item.unitCost
        totalReceivedAmount += lineTotal

        await db.update(restockOrderItems).set({ qtyReceived: receivedQty, lineTotal }).where(eq(restockOrderItems.id, item.id))

        const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1)
        if (!product) continue

        await createInventoryBatch({
            productId: item.productId,
            sourceType: 'supplier',
            originalQty: receivedQty,
            unitCost: item.unitCost,
            sourceRefId: id,
            restockOrderItemId: item.id,
            supplierId: order.supplierId,
            receivedAt: new Date(),
            notes: `Restock ${order.referenceNumber ?? id.slice(0, 8)}`,
            writeHistory: true
        })
    }

    await db
        .update(restockOrders)
        .set({
            status: 'received',
            receivedAt: new Date(),
            totalAmount: totalReceivedAmount,
            updatedAt: new Date()
        })
        .where(eq(restockOrders.id, id))

    if (totalReceivedAmount > 0) {
        await createSupplierTransaction({
            supplierId: order.supplierId,
            restockOrderId: id,
            type: 'purchase',
            amount: totalReceivedAmount,
            description: `Goods received for restock order ${order.referenceNumber ?? id.slice(0, 8)}`,
            createdById: receivedById,
            paymentMode: 'cash'
        })
    }

    return getRestockWithItems(id)
}

export async function recordRestockPayment(
    restockOrderId: string,
    amount: number,
    userId: string,
    notes?: string,
    proof?: { paymentMode?: string; proofImage?: string; proofImagePublicId?: string }
) {
    const [order] = await db.select().from(restockOrders).where(eq(restockOrders.id, restockOrderId)).limit(1)
    if (!order) throw new AppError('Restock order not found', 404)
    if (order.status !== 'received') throw new AppError('Payments can only be recorded on received restock orders', 400)
    if (amount <= 0) throw new AppError('Payment amount must be positive', 400)

    const outstanding = order.totalAmount - (order.amountPaid ?? 0)
    if (amount > outstanding) throw new AppError(`Payment cannot exceed outstanding amount (${outstanding})`, 400)

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId)).limit(1)
    if (!supplier) throw new AppError('Supplier not found', 404)

    await createSupplierTransaction({
        supplierId: order.supplierId,
        restockOrderId,
        type: 'payment',
        amount,
        description: notes?.trim() || `Payment for restock order ${order.referenceNumber ?? restockOrderId.slice(0, 8)}`,
        createdById: userId,
        paymentMode: proof?.paymentMode ?? 'cash',
        proofImage: proof?.proofImage,
        proofImagePublicId: proof?.proofImagePublicId
    })

    await db
        .update(restockOrders)
        .set({ amountPaid: (order.amountPaid ?? 0) + amount, updatedAt: new Date() })
        .where(eq(restockOrders.id, restockOrderId))

    return getRestockWithItems(restockOrderId)
}

export async function recordRestockRefund(
    restockOrderId: string,
    userId: string,
    notes?: string,
    returnedItems?: ReturnedItemInput[],
    requestedCashRefund?: number,
    proof?: { paymentMode?: string; proofImage?: string; proofImagePublicId?: string }
) {
    const [order] = await db.select().from(restockOrders).where(eq(restockOrders.id, restockOrderId)).limit(1)
    if (!order) throw new AppError('Restock order not found', 404)
    if (order.status !== 'received') throw new AppError('Refunds can only be recorded on received restock orders', 400)
    if (!returnedItems?.length) throw new AppError('returnedItems are required to return stock to the supplier', 400)

    const paid = order.amountPaid ?? 0
    const alreadyRefunded = order.amountRefunded ?? 0

    const returnValue = await applyRestockItemReturns(restockOrderId, returnedItems)
    const newTotalAmount = await recalculateRestockOrderTotals(restockOrderId)

    // Cash back from supplier only when we have paid more than we still owe for kept stock.
    const maxCashRefund = Math.min(returnValue, Math.max(0, paid - alreadyRefunded - newTotalAmount))
    const cashRefund = typeof requestedCashRefund === 'number' && !Number.isNaN(requestedCashRefund) ? requestedCashRefund : maxCashRefund

    if (cashRefund < 0) throw new AppError('Refund amount must be non-negative', 400)
    if (cashRefund > maxCashRefund) {
        throw new AppError(`Cash refund cannot exceed ${maxCashRefund} for this return`, 400)
    }
    if (cashRefund > paid - alreadyRefunded) {
        throw new AppError(`Cash refund cannot exceed amount paid minus prior refunds (${paid - alreadyRefunded})`, 400)
    }

    // Payable Out for returned goods (whether or not cash came back).
    await createSupplierTransaction({
        supplierId: order.supplierId,
        restockOrderId,
        type: 'return',
        amount: returnValue,
        description:
            notes?.trim() ||
            `Goods returned on restock order ${order.referenceNumber ?? restockOrderId.slice(0, 8)}${
                cashRefund > 0 ? ` (cash back PKR ${cashRefund})` : ''
            }`,
        createdById: userId,
        paymentMode: proof?.paymentMode ?? 'cash',
        proofImage: proof?.proofImage,
        proofImagePublicId: proof?.proofImagePublicId
    })

    await db
        .update(restockOrders)
        .set({
            amountRefunded: alreadyRefunded + cashRefund,
            updatedAt: new Date()
        })
        .where(eq(restockOrders.id, restockOrderId))

    return getRestockWithItems(restockOrderId)
}

export async function cancelRestockOrder(id: string) {
    const [updated] = await db
        .update(restockOrders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(restockOrders.id, id), eq(restockOrders.status, 'draft')))
        .returning()

    if (!updated) throw new AppError('Only draft restock orders can be cancelled', 400)
    return getRestockWithItems(id)
}

/** Super-admin purge: removes restock order and owned items; linked ledger/stock-history refs are nulled by FK. */
export async function deleteRestockOrderPermanently(id: string) {
    const [order] = await db.select().from(restockOrders).where(eq(restockOrders.id, id)).limit(1)
    if (!order) throw new AppError('Restock order not found', 404)

    await db.transaction(async (tx) => {
        const items = await tx.select({ id: restockOrderItems.id }).from(restockOrderItems).where(eq(restockOrderItems.restockOrderId, id))
        for (const item of items) {
            await tx
                .update(productStockHistory)
                .set({ restockOrderItemId: null })
                .where(eq(productStockHistory.restockOrderItemId, item.id))
        }
        await tx
            .update(supplierTransactions)
            .set({ restockOrderId: null })
            .where(eq(supplierTransactions.restockOrderId, id))
        await tx.delete(restockOrders).where(eq(restockOrders.id, id))
    })

    return { message: 'Restock order deleted permanently' }
}

export async function addRestockOrderItem(restockOrderId: string, item: RestockItemInput) {
    const [order] = await db.select().from(restockOrders).where(eq(restockOrders.id, restockOrderId)).limit(1)
    if (!order) throw new AppError('Restock order not found', 404)
    if (order.status !== 'draft') throw new AppError('Can only modify draft restock orders', 400)

    await db.insert(restockOrderItems).values({
        id: createId(),
        restockOrderId,
        productId: item.productId,
        qtyOrdered: item.qtyOrdered,
        unitCost: item.unitCost,
        lineTotal: item.qtyOrdered * item.unitCost
    })

    const items = await db.select().from(restockOrderItems).where(eq(restockOrderItems.restockOrderId, restockOrderId))
    const totalAmount = items.reduce((acc, row) => acc + row.lineTotal, 0)
    await db.update(restockOrders).set({ totalAmount, updatedAt: new Date() }).where(eq(restockOrders.id, restockOrderId))

    return getRestockWithItems(restockOrderId)
}

export async function getProductRestockHistory(productId: string) {
    return db.select().from(productStockHistory).where(eq(productStockHistory.productId, productId)).orderBy(desc(productStockHistory.recordedAt))
}
