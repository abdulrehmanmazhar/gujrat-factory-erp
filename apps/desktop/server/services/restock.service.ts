// @ts-nocheck
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { products, productStockHistory, restockOrderItems, restockOrders, suppliers, transactions } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

type RestockItemInput = { productId: string; qtyOrdered: number; unitCost: number }

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

        const newStockQty = product.stockQty + receivedQty
        const purchasePrice = item.unitCost

        await db.insert(productStockHistory).values({
            id: createId(),
            productId: item.productId,
            qty: receivedQty,
            totalBill: lineTotal,
            purchasePrice,
            restockOrderItemId: item.id,
            recordedAt: new Date()
        })

        await db
            .update(products)
            .set({
                stockQty: newStockQty,
                inStock: newStockQty > 0,
                purchasePrice,
                updatedAt: new Date()
            })
            .where(eq(products.id, item.productId))
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

    await db.insert(transactions).values({
        id: createId(),
        type: 'investment',
        amount: totalReceivedAmount,
        description: `Restock received from supplier ${order.supplier?.name ?? order.supplierId}`,
        createdById: receivedById
    })

    return getRestockWithItems(id)
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
