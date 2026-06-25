// @ts-nocheck
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { products, productSales, productStockHistory } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export async function adjustProductStock(customerId: string, productId: string, qty: number, action: 'add' | 'minus') {
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw new AppError('Product not found', 400)

    const newStockState = action === 'add' ? product.stockQty + qty : product.stockQty - qty

    await db.insert(productSales).values({
        id: createId(),
        customerId,
        productId,
        stockQtyLeft: newStockState,
        sold: action === 'add' ? -qty : qty
    })

    await db
        .update(products)
        .set({
            stockQty: newStockState,
            inStock: newStockState > 0,
            updatedAt: new Date()
        })
        .where(eq(products.id, productId))

    return true
}

export async function addProduct(data: {
    name: string
    category: string
    price: number
    stockQty: number
    totalBill: number
    discount?: number
    createdById: string
}) {
    const [existing] = await db
        .select()
        .from(products)
        .where(and(eq(products.name, data.name), eq(products.category, data.category)))
        .limit(1)
    if (existing) throw new AppError('Product already exists', 400)

    const purchasePrice = data.totalBill / data.stockQty
    const productId = createId()

    const [product] = await db
        .insert(products)
        .values({
            id: productId,
            name: data.name,
            category: data.category,
            price: data.price,
            stockQty: data.stockQty,
            inStock: data.stockQty > 0,
            purchasePrice,
            discount: data.discount ?? 0
        })
        .returning()

    await db.insert(productStockHistory).values({
        id: createId(),
        productId,
        qty: data.stockQty,
        purchasePrice,
        recordedAt: new Date()
    })

    const history = await getProductHistory(productId)
    return { ...withLegacyId(product), history }
}

export async function editProduct(id: string, data: { name: string; category: string; price: number; stockQty: number }) {
    const [target] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!target) throw new AppError('Target product not found', 400)

    const [duplicate] = await db
        .select()
        .from(products)
        .where(
            and(
                eq(products.name, data.name),
                eq(products.category, data.category),
                eq(products.price, data.price),
                eq(products.stockQty, data.stockQty)
            )
        )
        .limit(1)
    if (duplicate && duplicate.id !== id) throw new AppError('Same product found so you cannot proceed', 400)

    const [edited] = await db
        .update(products)
        .set({
            name: data.name,
            category: data.category,
            price: data.price,
            stockQty: data.stockQty,
            inStock: data.stockQty > 0,
            updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning()

    return withLegacyId(edited)
}

export async function getProductHistory(productId: string) {
    return db.select().from(productStockHistory).where(eq(productStockHistory.productId, productId)).orderBy(desc(productStockHistory.recordedAt))
}

export async function listProducts() {
    const allProducts = await db.select().from(products).orderBy(desc(products.createdAt))
    if (!allProducts.length) throw new AppError('No products found', 404)

    const sales = await db.select().from(productSales)

    return allProducts.map((product) => ({
        ...withLegacyId(product),
        productSale: sales.filter((sale) => sale.productId === product.id).map(withLegacyId),
        history: [] as unknown[]
    }))
}

export async function deleteProduct(id: string) {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!product) throw new AppError('Product not found with this id', 400)
    await db.delete(products).where(eq(products.id, id))
}

export async function restockProduct(
    id: string,
    data: { price: number; stockQty: number; discount?: number; totalBill: number; createdById: string }
) {
    const [target] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!target) throw new AppError('Target product not found', 400)

    const purchasePrice = data.totalBill / data.stockQty
    const newStockQty = target.stockQty + data.stockQty

    await db.insert(productStockHistory).values({
        id: createId(),
        productId: id,
        qty: data.stockQty,
        purchasePrice,
        recordedAt: new Date()
    })

    const [edited] = await db
        .update(products)
        .set({
            price: data.price,
            stockQty: newStockQty,
            discount: data.discount ?? target.discount ?? 0,
            purchasePrice,
            inStock: newStockQty > 0,
            updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning()

    return withLegacyId(edited)
}

export async function findProductsByIds(ids: string[]) {
    if (!ids.length) return []
    const rows = await db.select().from(products)
    return rows.filter((p) => ids.includes(p.id))
}

export async function getProductById(id: string) {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    return product ?? null
}

export async function adjustInventoryQty(productId: string, qtyDelta: number, options?: { historyNote?: string; purchasePrice?: number }) {
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw new AppError('Product not found', 404)

    const newStockQty = product.stockQty + qtyDelta
    if (newStockQty < 0) {
        throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.stockQty}`, 400)
    }

    if (qtyDelta !== 0) {
        await db.insert(productStockHistory).values({
            id: createId(),
            productId,
            qty: Math.abs(qtyDelta),
            purchasePrice: options?.purchasePrice ?? product.purchasePrice ?? 0,
            recordedAt: new Date()
        })
    }

    const [updated] = await db
        .update(products)
        .set({
            stockQty: newStockQty,
            inStock: newStockQty > 0,
            updatedAt: new Date()
        })
        .where(eq(products.id, productId))
        .returning()

    return withLegacyId(updated)
}
