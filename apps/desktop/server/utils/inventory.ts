// @ts-nocheck
import { and, eq } from 'drizzle-orm'
import { orders, products, productSales } from '../models/tables.js'
import { AppError } from './errors.js'
import { createId } from './mappers.js'

type DbConn = {
    select: (...args: unknown[]) => unknown
    insert: (...args: unknown[]) => unknown
    update: (...args: unknown[]) => unknown
}

export async function adjustProductStockTx(dbConn: DbConn, customerId: string, productId: string, qty: number, action: 'add' | 'minus') {
    const [product] = await dbConn.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw new AppError('Product not found', 400)

    const newStockState = action === 'add' ? product.stockQty + qty : product.stockQty - qty
    if (newStockState < 0) {
        throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.stockQty}, required: ${qty}`, 400)
    }

    await dbConn.insert(productSales).values({
        id: createId(),
        customerId,
        productId,
        stockQtyLeft: newStockState,
        sold: action === 'add' ? -qty : qty
    })

    await dbConn
        .update(products)
        .set({
            stockQty: newStockState,
            inStock: newStockState > 0,
            updatedAt: new Date()
        })
        .where(eq(products.id, productId))

    return newStockState
}

export async function canFulfillOrderItems(dbConn: DbConn, items: Array<{ productId: string; qty: number }>) {
    if (!items.length) return { ok: true as const }

    const demand = new Map<string, number>()
    for (const { productId, qty } of items) {
        demand.set(productId, (demand.get(productId) ?? 0) + qty)
    }

    for (const [productId, required] of demand) {
        const [product] = await dbConn.select().from(products).where(eq(products.id, productId)).limit(1)
        if (!product) {
            return { ok: false as const, productId, productName: 'Unknown product', available: 0, required }
        }
        if (product.stockQty < required) {
            return {
                ok: false as const,
                productId,
                productName: product.name,
                available: product.stockQty,
                required
            }
        }
    }

    return { ok: true as const }
}

export async function deductOrderStockTx(dbConn: DbConn, orderId: string, customerId: string, items: Array<{ productId: string; qty: number }>) {
    const [order] = await dbConn.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (order.stockDeducted) return false

    for (const item of items) {
        await adjustProductStockTx(dbConn, customerId, item.productId, item.qty, 'minus')
    }

    await dbConn
        .update(orders)
        .set({ stockDeducted: true, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.stockDeducted, false)))

    return true
}

export async function restoreOrderStockTx(dbConn: DbConn, orderId: string, customerId: string, items: Array<{ productId: string; qty: number }>) {
    const [order] = await dbConn.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (!order.stockDeducted) return false

    for (const item of items) {
        await adjustProductStockTx(dbConn, customerId, item.productId, item.qty, 'add')
    }

    await dbConn.update(orders).set({ stockDeducted: false, updatedAt: new Date() }).where(eq(orders.id, orderId))
    return true
}
