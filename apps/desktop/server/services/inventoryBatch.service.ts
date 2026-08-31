// @ts-nocheck
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '../utils/db.js'
import {
    inventoryBatchAllocations,
    inventoryBatches,
    labourers,
    products,
    productStockHistory,
    suppliers
} from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export type BatchDb = typeof db
export type InventorySourceType = 'supplier' | 'labour' | 'opening' | 'conversion' | 'manual'
export type AllocationReason = 'sale' | 'production' | 'conversion' | 'return' | 'restore' | 'adjustment'

export type CreateBatchInput = {
    productId: string
    sourceType: InventorySourceType
    originalQty: number
    unitCost: number
    sourceRefId?: string | null
    restockOrderItemId?: string | null
    labourProductionEntryId?: string | null
    conversionId?: string | null
    supplierId?: string | null
    labourerId?: string | null
    receivedAt?: Date
    notes?: string | null
    writeHistory?: boolean
}

export type ConsumeOptions = {
    reason: AllocationReason
    orderId?: string | null
    productSaleId?: string | null
    labourProductionEntryId?: string | null
    conversionId?: string | null
    restockOrderItemId?: string | null
    preferredBatchIds?: string[]
    updateProductStock?: boolean
    writeHistory?: boolean
}

export type AllocationLine = {
    id: string
    batchId: string
    productId: string
    qty: number
    unitCost: number
    reason: AllocationReason
}

async function syncProductCostAndStock(conn: BatchDb, productId: string, stockQty?: number) {
    const open = await conn
        .select({ remainingQty: inventoryBatches.remainingQty, unitCost: inventoryBatches.unitCost })
        .from(inventoryBatches)
        .where(and(eq(inventoryBatches.productId, productId), gt(inventoryBatches.remainingQty, 0)))

    const remaining = open.reduce((sum, row) => sum + (row.remainingQty ?? 0), 0)
    const value = open.reduce((sum, row) => sum + (row.remainingQty ?? 0) * (row.unitCost ?? 0), 0)
    const avgCost = remaining > 0 ? value / remaining : 0
    const nextStock = stockQty ?? remaining

    await conn
        .update(products)
        .set({
            stockQty: nextStock,
            inStock: nextStock > 0,
            purchasePrice: remaining > 0 ? avgCost : null,
            updatedAt: new Date()
        })
        .where(eq(products.id, productId))

    return { remaining, avgCost, stockQty: nextStock }
}

export async function createInventoryBatch(input: CreateBatchInput, conn: BatchDb = db) {
    if (!Number.isFinite(input.originalQty) || input.originalQty <= 0) {
        throw new AppError('Batch quantity must be positive', 400)
    }
    if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
        throw new AppError('Batch unit cost must be a non-negative number', 400)
    }

    const [product] = await conn.select().from(products).where(eq(products.id, input.productId)).limit(1)
    if (!product) throw new AppError('Product not found', 404)

    const batchId = createId()
    const receivedAt = input.receivedAt ?? new Date()
    const [batch] = await conn
        .insert(inventoryBatches)
        .values({
            id: batchId,
            productId: input.productId,
            sourceType: input.sourceType,
            sourceRefId: input.sourceRefId ?? null,
            restockOrderItemId: input.restockOrderItemId ?? null,
            labourProductionEntryId: input.labourProductionEntryId ?? null,
            conversionId: input.conversionId ?? null,
            supplierId: input.supplierId ?? null,
            labourerId: input.labourerId ?? null,
            originalQty: input.originalQty,
            remainingQty: input.originalQty,
            unitCost: input.unitCost,
            receivedAt,
            notes: input.notes ?? null
        })
        .returning()

    if (input.writeHistory !== false) {
        await conn.insert(productStockHistory).values({
            id: createId(),
            productId: input.productId,
            qty: input.originalQty,
            purchasePrice: input.unitCost,
            restockOrderItemId: input.restockOrderItemId ?? null,
            recordedAt: receivedAt
        })
    }

    const newStock = product.stockQty + input.originalQty
    await syncProductCostAndStock(conn, input.productId, newStock)
    return withLegacyId(batch)
}

export async function consumeInventoryFifo(
    productId: string,
    qty: number,
    options: ConsumeOptions,
    conn: BatchDb = db
): Promise<{ allocations: AllocationLine[]; totalCost: number }> {
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('Quantity to consume must be positive', 400)

    const [product] = await conn.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw new AppError('Product not found', 404)
    if ((options.updateProductStock !== false) && product.stockQty < qty) {
        throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.stockQty}, required: ${qty}`, 400)
    }

    const openBatches = await conn
        .select()
        .from(inventoryBatches)
        .where(and(eq(inventoryBatches.productId, productId), gt(inventoryBatches.remainingQty, 0)))
        .orderBy(asc(inventoryBatches.receivedAt), asc(inventoryBatches.createdAt))

    const preferred = new Set(options.preferredBatchIds ?? [])
    const ordered = [
        ...openBatches.filter((batch) => preferred.has(batch.id)),
        ...openBatches.filter((batch) => !preferred.has(batch.id))
    ]

    let remaining = qty
    const allocations: AllocationLine[] = []
    let totalCost = 0

    for (const batch of ordered) {
        if (remaining <= 0) break
        const take = Math.min(batch.remainingQty, remaining)
        if (take <= 0) continue

        await conn
            .update(inventoryBatches)
            .set({ remainingQty: batch.remainingQty - take })
            .where(eq(inventoryBatches.id, batch.id))

        const allocationId = createId()
        await conn.insert(inventoryBatchAllocations).values({
            id: allocationId,
            batchId: batch.id,
            productId,
            qty: take,
            unitCost: batch.unitCost,
            reason: options.reason,
            orderId: options.orderId ?? null,
            productSaleId: options.productSaleId ?? null,
            labourProductionEntryId: options.labourProductionEntryId ?? null,
            conversionId: options.conversionId ?? null,
            restockOrderItemId: options.restockOrderItemId ?? null
        })

        allocations.push({
            id: allocationId,
            batchId: batch.id,
            productId,
            qty: take,
            unitCost: batch.unitCost,
            reason: options.reason
        })
        totalCost += take * batch.unitCost
        remaining -= take
    }

    if (remaining > 0) {
        throw new AppError(
            `Insufficient batch stock for ${product.name}. Need ${qty}, available in batches ${qty - remaining}`,
            400
        )
    }

    if (options.writeHistory) {
        await conn.insert(productStockHistory).values({
            id: createId(),
            productId,
            qty: -qty,
            purchasePrice: qty > 0 ? totalCost / qty : 0,
            restockOrderItemId: options.restockOrderItemId ?? null,
            recordedAt: new Date()
        })
    }

    if (options.updateProductStock !== false) {
        await syncProductCostAndStock(conn, productId, product.stockQty - qty)
    } else {
        await syncProductCostAndStock(conn, productId)
    }

    return { allocations, totalCost }
}

export async function restoreOrderBatchAllocations(orderId: string, conn: BatchDb = db) {
    const rows = await conn
        .select()
        .from(inventoryBatchAllocations)
        .where(and(eq(inventoryBatchAllocations.orderId, orderId), eq(inventoryBatchAllocations.reason, 'sale')))

    if (!rows.length) return { restoredQty: 0, productIds: [] as string[] }

    const byProduct = new Map<string, number>()
    for (const row of rows) {
        await conn
            .update(inventoryBatches)
            .set({ remainingQty: sql`${inventoryBatches.remainingQty} + ${row.qty}` })
            .where(eq(inventoryBatches.id, row.batchId))

        await conn.insert(inventoryBatchAllocations).values({
            id: createId(),
            batchId: row.batchId,
            productId: row.productId,
            qty: -row.qty,
            unitCost: row.unitCost,
            reason: 'restore',
            orderId,
            productSaleId: row.productSaleId,
            labourProductionEntryId: row.labourProductionEntryId,
            conversionId: row.conversionId,
            restockOrderItemId: row.restockOrderItemId
        })

        byProduct.set(row.productId, (byProduct.get(row.productId) ?? 0) + row.qty)
    }

    for (const [productId, qty] of byProduct) {
        const [product] = await conn.select().from(products).where(eq(products.id, productId)).limit(1)
        if (!product) continue
        await syncProductCostAndStock(conn, productId, product.stockQty + qty)
    }

    return { restoredQty: [...byProduct.values()].reduce((s, n) => s + n, 0), productIds: [...byProduct.keys()] }
}

export async function getProductBatchSummary(productId: string) {
    const batches = await db
        .select({
            batch: inventoryBatches,
            supplierName: suppliers.name,
            labourerName: labourers.name
        })
        .from(inventoryBatches)
        .leftJoin(suppliers, eq(inventoryBatches.supplierId, suppliers.id))
        .leftJoin(labourers, eq(inventoryBatches.labourerId, labourers.id))
        .where(eq(inventoryBatches.productId, productId))
        .orderBy(asc(inventoryBatches.receivedAt), asc(inventoryBatches.createdAt))

    const open = batches.filter((row) => row.batch.remainingQty > 0)
    const remainingQty = open.reduce((sum, row) => sum + row.batch.remainingQty, 0)
    const inventoryValue = open.reduce((sum, row) => sum + row.batch.remainingQty * row.batch.unitCost, 0)
    const averageCost = remainingQty > 0 ? inventoryValue / remainingQty : 0
    const fifoCost = open[0]?.batch.unitCost ?? null

    return {
        remainingQty,
        inventoryValue,
        averageCost,
        fifoCost,
        batches: batches.map(({ batch, supplierName, labourerName }) => ({
            ...withLegacyId(batch),
            supplierName: supplierName ?? null,
            labourerName: labourerName ?? null,
            sourceLabel:
                batch.sourceType === 'supplier'
                    ? supplierName
                        ? `Supplier: ${supplierName}`
                        : 'Supplier'
                    : batch.sourceType === 'labour'
                      ? labourerName
                          ? `Labour: ${labourerName}`
                          : 'Labour production'
                      : batch.sourceType === 'opening'
                        ? 'Opening balance'
                        : batch.sourceType === 'conversion'
                          ? 'Conversion'
                          : 'Manual restock'
        }))
    }
}

export async function listOpenBatchesForProducts(productIds: string[]) {
    if (!productIds.length) return []
    return db
        .select()
        .from(inventoryBatches)
        .where(and(inArray(inventoryBatches.productId, productIds), gt(inventoryBatches.remainingQty, 0)))
        .orderBy(asc(inventoryBatches.receivedAt), asc(inventoryBatches.createdAt))
}

export async function findBatchesForRestockItem(restockOrderItemId: string, conn: BatchDb = db) {
    return conn
        .select()
        .from(inventoryBatches)
        .where(and(eq(inventoryBatches.restockOrderItemId, restockOrderItemId), gt(inventoryBatches.remainingQty, 0)))
        .orderBy(asc(inventoryBatches.receivedAt), asc(inventoryBatches.createdAt))
}
