// @ts-nocheck
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { productCategories, products, productSales, productStockHistory, units } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { assertUnitExists } from './unit.service.js'
import { assertCategoriesExist, buildCategoryPathMap } from './category.service.js'

const DEFAULT_UNIT_ID = 'unit-pcs'

export async function adjustProductStock(customerId: string, productId: string, qty: number, action: 'add' | 'minus') {
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw new AppError('Product not found', 400)

    const newStockState = action === 'add' ? product.stockQty + qty : product.stockQty - qty
    if (newStockState < 0) {
        throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.stockQty}, required: ${qty}`, 400)
    }

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

function resolvePurchasePrice(totalBill: number, stockQty: number) {
    if (!Number.isFinite(totalBill) || totalBill < 0) {
        throw new AppError('Total cost must be a non-negative number', 400)
    }
    if (!Number.isFinite(stockQty) || stockQty < 0) {
        throw new AppError('Stock quantity must be a non-negative number', 400)
    }
    if (stockQty === 0) {
        return totalBill > 0 ? totalBill : 0
    }
    return totalBill / stockQty
}

function normalizeCategoryIds(categoryIds?: string[] | null) {
    if (Array.isArray(categoryIds)) {
        return [...new Set(categoryIds.map((id) => String(id || '').trim()).filter(Boolean))]
    }
    return []
}

async function resolveCategoryLabel(categoryIds: string[]) {
    if (!categoryIds.length) return 'Uncategorized'
    const { pathById } = await buildCategoryPathMap()
    const labels = categoryIds.map((id) => pathById.get(id)).filter(Boolean)
    return labels.length ? labels.join(', ') : 'Uncategorized'
}

async function syncProductCategories(productId: string, categoryIds: string[]) {
    await db.delete(productCategories).where(eq(productCategories.productId, productId))
    if (!categoryIds.length) return []

    await db.insert(productCategories).values(
        categoryIds.map((categoryId) => ({
            productId,
            categoryId
        }))
    )

    const { pathById, byId } = await buildCategoryPathMap()
    return categoryIds
        .map((id) => {
            const row = byId.get(id)
            if (!row) return null
            return {
                ...withLegacyId(row),
                parentId: row.parentId ?? null,
                path: pathById.get(id) ?? row.name
            }
        })
        .filter(Boolean)
}

async function loadCategoriesForProducts(productIds: string[]) {
    if (!productIds.length) return new Map()
    const links = await db.select().from(productCategories).where(inArray(productCategories.productId, productIds))
    const { pathById, byId } = await buildCategoryPathMap()
    const map = new Map()

    for (const link of links) {
        const row = byId.get(link.categoryId)
        if (!row) continue
        const list = map.get(link.productId) ?? []
        list.push({
            ...withLegacyId(row),
            parentId: row.parentId ?? null,
            path: pathById.get(row.id) ?? row.name
        })
        map.set(link.productId, list)
    }
    return map
}

export async function addProduct(data: {
    name: string
    category?: string
    categoryIds?: string[]
    price: number
    stockQty: number
    totalBill: number
    discount?: number
    unitId?: string
    createdById: string
}) {
    if (!Number.isFinite(data.stockQty) || data.stockQty < 0) {
        throw new AppError('Stock quantity must be a non-negative number', 400)
    }

    const unitId = data.unitId?.trim() || DEFAULT_UNIT_ID
    await assertUnitExists(unitId)

    const categoryIds = await assertCategoriesExist(normalizeCategoryIds(data.categoryIds))
    const categoryLabel = categoryIds.length ? await resolveCategoryLabel(categoryIds) : String(data.category || '').trim() || 'Uncategorized'

    const [existing] = await db
        .select()
        .from(products)
        .where(and(eq(products.name, data.name), eq(products.category, categoryLabel)))
        .limit(1)
    if (existing) throw new AppError('Product already exists', 400)

    const purchasePrice = resolvePurchasePrice(Number(data.totalBill) || 0, data.stockQty)
    const productId = createId()

    const [product] = await db
        .insert(products)
        .values({
            id: productId,
            name: data.name,
            category: categoryLabel,
            price: data.price,
            stockQty: data.stockQty,
            inStock: data.stockQty > 0,
            purchasePrice,
            discount: data.discount ?? 0,
            unitId
        })
        .returning()

    const linkedCategories = await syncProductCategories(productId, categoryIds)

    if (data.stockQty > 0) {
        await db.insert(productStockHistory).values({
            id: createId(),
            productId,
            qty: data.stockQty,
            purchasePrice,
            recordedAt: new Date()
        })
    }

    const history = await getProductHistory(productId)
    const unit = await assertUnitExists(unitId)
    return {
        ...withLegacyId(product),
        unit,
        history,
        categories: linkedCategories,
        categoryIds: linkedCategories.map((c) => c.id)
    }
}

export async function editProduct(id: string, data: { name: string; category?: string; categoryIds?: string[]; price: number; unitId?: string }) {
    const [target] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!target) throw new AppError('Target product not found', 400)

    const unitId = data.unitId?.trim() || target.unitId || DEFAULT_UNIT_ID
    await assertUnitExists(unitId)

    let categoryIds: string[]
    if (data.categoryIds !== undefined) {
        categoryIds = await assertCategoriesExist(normalizeCategoryIds(data.categoryIds))
    } else {
        const existingLinks = await db.select().from(productCategories).where(eq(productCategories.productId, id))
        categoryIds = existingLinks.map((link) => link.categoryId)
    }
    const categoryLabel = categoryIds.length
        ? await resolveCategoryLabel(categoryIds)
        : String(data.category || target.category || '').trim() || 'Uncategorized'

    const [duplicate] = await db
        .select()
        .from(products)
        .where(
            and(
                eq(products.name, data.name),
                eq(products.category, categoryLabel),
                eq(products.price, data.price),
                eq(products.stockQty, target.stockQty)
            )
        )
        .limit(1)
    if (duplicate && duplicate.id !== id) throw new AppError('Same product found so you cannot proceed', 400)

    const [edited] = await db
        .update(products)
        .set({
            name: data.name,
            category: categoryLabel,
            price: data.price,
            unitId,
            updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning()

    const linkedCategories = await syncProductCategories(id, categoryIds)
    const unit = await assertUnitExists(unitId)
    return {
        ...withLegacyId(edited),
        unit,
        categories: linkedCategories,
        categoryIds: linkedCategories.map((c) => c.id)
    }
}

export async function getProductHistory(productId: string) {
    return db.select().from(productStockHistory).where(eq(productStockHistory.productId, productId)).orderBy(desc(productStockHistory.recordedAt))
}

export async function listProducts() {
    const allProducts = await db.select().from(products).orderBy(desc(products.createdAt))
    if (!allProducts.length) throw new AppError('No products found', 404)

    const sales = await db.select().from(productSales)
    const allUnits = await db.select().from(units)
    const unitById = new Map(allUnits.map((unit) => [unit.id, withLegacyId(unit)]))
    const categoriesByProduct = await loadCategoriesForProducts(allProducts.map((p) => p.id))

    return allProducts.map((product) => {
        const linkedCategories = categoriesByProduct.get(product.id) ?? []
        return {
            ...withLegacyId(product),
            unit: unitById.get(product.unitId) ?? null,
            categories: linkedCategories,
            categoryIds: linkedCategories.map((c) => c.id),
            productSale: sales.filter((sale) => sale.productId === product.id).map(withLegacyId),
            history: [] as unknown[]
        }
    })
}

export async function deleteProduct(id: string) {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!product) throw new AppError('Product not found with this id', 400)
    await db.delete(productCategories).where(eq(productCategories.productId, id))
    await db.delete(products).where(eq(products.id, id))
}

export async function restockProduct(
    id: string,
    data: { price: number; stockQty: number; discount?: number; totalBill: number; createdById: string }
) {
    const [target] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!target) throw new AppError('Target product not found', 400)

    if (!Number.isFinite(data.stockQty) || data.stockQty <= 0) {
        throw new AppError('Restock quantity must be greater than zero', 400)
    }

    const purchasePrice = resolvePurchasePrice(Number(data.totalBill) || 0, data.stockQty)
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
