// @ts-nocheck
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../utils/db.js'
import {
    customerTransactions,
    labourProductionConsumption,
    labourProductionEntries,
    labourerTransactions,
    orderItems,
    orders,
    productCategories,
    productConversions,
    products,
    productSales,
    productStockHistory,
    recipeItems,
    recipes,
    restockOrderItems,
    restockOrders,
    supplierTransactions,
    units
} from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { adjustProductStockTx } from '../utils/inventory.js'
import { createInventoryBatch, getProductBatchSummary, consumeInventoryFifo } from './inventoryBatch.service.js'
import { assertUnitExists } from './unit.service.js'
import { assertCategoriesExist, buildCategoryPathMap } from './category.service.js'

const DEFAULT_UNIT_ID = 'unit-pcs'

export async function adjustProductStock(customerId: string, productId: string, qty: number, action: 'add' | 'minus', orderId?: string) {
    return db.transaction(async (tx) => adjustProductStockTx(tx, customerId, productId, qty, action, orderId))
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

export async function loadCategoriesForProducts(productIds: string[]) {
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
            stockQty: 0,
            inStock: false,
            purchasePrice,
            discount: data.discount ?? 0,
            unitId
        })
        .returning()

    const linkedCategories = await syncProductCategories(productId, categoryIds)

    if (data.stockQty > 0) {
        await createInventoryBatch({
            productId,
            sourceType: 'manual',
            originalQty: data.stockQty,
            unitCost: purchasePrice,
            notes: 'Initial product stock',
            writeHistory: true
        })
    } else {
        await db
            .update(products)
            .set({ purchasePrice, updatedAt: new Date() })
            .where(eq(products.id, productId))
    }

    const history = await getProductHistory(productId)
    const batchSummary = await getProductBatchSummary(productId)
    const unit = await assertUnitExists(unitId)
    const [fresh] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    return {
        ...withLegacyId(fresh ?? product),
        unit,
        history,
        categories: linkedCategories,
        categoryIds: linkedCategories.map((c) => c.id),
        averageCost: batchSummary.averageCost,
        fifoCost: batchSummary.fifoCost,
        inventoryValue: batchSummary.inventoryValue,
        batches: batchSummary.batches
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

    return Promise.all(
        allProducts.map(async (product) => {
            const linkedCategories = categoriesByProduct.get(product.id) ?? []
            const batchSummary = await getProductBatchSummary(product.id)
            return {
                ...withLegacyId(product),
                unit: unitById.get(product.unitId) ?? null,
                categories: linkedCategories,
                categoryIds: linkedCategories.map((c) => c.id),
                productSale: sales.filter((sale) => sale.productId === product.id).map(withLegacyId),
                history: [] as unknown[],
                averageCost: batchSummary.averageCost,
                fifoCost: batchSummary.fifoCost,
                inventoryValue: batchSummary.inventoryValue,
                batches: batchSummary.batches.filter((batch) => batch.remainingQty > 0)
            }
        })
    )
}

export async function deleteProduct(id: string) {
    await db.transaction(async (tx) => {
        const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1)
        if (!product) throw new AppError('Product not found with this id', 404)

        // A product is never left attached to a partial order/restock: remove
        // the complete parent record and all of its ledger rows instead.
        const orderRows = await tx
            .select({ orderId: orderItems.orderId })
            .from(orderItems)
            .where(eq(orderItems.productId, id))
        const orderIds = [...new Set(orderRows.map((row) => row.orderId))]
        if (orderIds.length) {
            await tx.delete(customerTransactions).where(inArray(customerTransactions.orderId, orderIds))
            await tx.delete(orders).where(inArray(orders.id, orderIds))
        }

        const restockRows = await tx
            .select({ restockOrderId: restockOrderItems.restockOrderId, id: restockOrderItems.id })
            .from(restockOrderItems)
            .where(eq(restockOrderItems.productId, id))
        const restockIds = [...new Set(restockRows.map((row) => row.restockOrderId))]
        if (restockIds.length) {
            const restockItems = await tx
                .select({ id: restockOrderItems.id })
                .from(restockOrderItems)
                .where(inArray(restockOrderItems.restockOrderId, restockIds))
            const restockItemIds = restockItems.map((row) => row.id)
            if (restockItemIds.length) {
                await tx.delete(productStockHistory).where(inArray(productStockHistory.restockOrderItemId, restockItemIds))
            }
            await tx.delete(supplierTransactions).where(inArray(supplierTransactions.restockOrderId, restockIds))
            await tx.delete(restockOrders).where(inArray(restockOrders.id, restockIds))
        }

        const consumingEntries = await tx
            .select({ entryId: labourProductionConsumption.entryId })
            .from(labourProductionConsumption)
            .where(eq(labourProductionConsumption.productId, id))
        const consumingEntryIds = [...new Set(consumingEntries.map((row) => row.entryId))]
        const productionFilter = consumingEntryIds.length
            ? or(eq(labourProductionEntries.productId, id), inArray(labourProductionEntries.id, consumingEntryIds))
            : eq(labourProductionEntries.productId, id)
        const productionEntries = await tx
            .select({ id: labourProductionEntries.id, labourerTransactionId: labourProductionEntries.labourerTransactionId })
            .from(labourProductionEntries)
            .where(productionFilter)
        const productionTransactionIds = productionEntries.flatMap((entry) => (entry.labourerTransactionId ? [entry.labourerTransactionId] : []))
        if (productionTransactionIds.length) {
            await tx.delete(labourerTransactions).where(inArray(labourerTransactions.id, productionTransactionIds))
        }
        if (productionEntries.length) {
            await tx.delete(labourProductionEntries).where(inArray(labourProductionEntries.id, productionEntries.map((entry) => entry.id)))
        }
        await tx.delete(productConversions).where(or(eq(productConversions.inputProductId, id), eq(productConversions.outputProductId, id)))
        await tx.delete(recipeItems).where(eq(recipeItems.ingredientProductId, id))
        await tx.delete(recipes).where(eq(recipes.outputProductId, id))
        await tx.delete(products).where(eq(products.id, id))
    })
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

    await createInventoryBatch({
        productId: id,
        sourceType: 'manual',
        originalQty: data.stockQty,
        unitCost: purchasePrice,
        notes: 'Manual restock',
        writeHistory: true
    })

    const [edited] = await db
        .update(products)
        .set({
            price: data.price,
            discount: data.discount ?? target.discount ?? 0,
            updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning()

    const batchSummary = await getProductBatchSummary(id)
    return {
        ...withLegacyId(edited),
        averageCost: batchSummary.averageCost,
        fifoCost: batchSummary.fifoCost,
        inventoryValue: batchSummary.inventoryValue,
        batches: batchSummary.batches.filter((batch) => batch.remainingQty > 0)
    }
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

export async function adjustInventoryQty(
    productId: string,
    qtyDelta: number,
    options?: {
        historyNote?: string
        purchasePrice?: number
        sourceType?: 'manual' | 'labour' | 'conversion'
        labourProductionEntryId?: string
        labourerId?: string
        conversionId?: string
        reason?: 'production' | 'conversion' | 'adjustment'
        writeHistory?: boolean
    }
) {
    if (qtyDelta === 0) {
        const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
        if (!product) throw new AppError('Product not found', 404)
        return withLegacyId(product)
    }

    if (qtyDelta > 0) {
        await createInventoryBatch({
            productId,
            sourceType: options?.sourceType ?? 'manual',
            originalQty: qtyDelta,
            unitCost: options?.purchasePrice ?? 0,
            labourProductionEntryId: options?.labourProductionEntryId,
            labourerId: options?.labourerId,
            conversionId: options?.conversionId,
            notes: options?.historyNote ?? null,
            writeHistory: options?.writeHistory !== false
        })
    } else {
        await consumeInventoryFifo(productId, Math.abs(qtyDelta), {
            reason: options?.reason ?? 'adjustment',
            labourProductionEntryId: options?.labourProductionEntryId,
            conversionId: options?.conversionId,
            writeHistory: options?.writeHistory === true,
            updateProductStock: true
        })
    }

    const [updated] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!updated) throw new AppError('Product not found', 404)
    return withLegacyId(updated)
}
