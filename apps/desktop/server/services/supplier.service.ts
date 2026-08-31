// @ts-nocheck
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { products, productStockHistory, restockOrderItems, restockOrders, supplierProducts, supplierTransactions, suppliers } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { assertValidWhatsAppContact } from '../utils/phone.js'
import { computeSupplierPayable, loadSupplierPayable, standaloneSupplierNet } from '../utils/ledger.js'
import { getProductIdsForCategories } from './category.service.js'

export async function createSupplier(data: { name: string; contact: string; businessName?: string; address?: string; notes?: string }) {
    const contact = assertValidWhatsAppContact(data.contact, 'Contact')
    const [supplier] = await db
        .insert(suppliers)
        .values({
            id: createId(),
            name: data.name,
            contact,
            businessName: data.businessName,
            address: data.address,
            notes: data.notes
        })
        .returning()

    return withLegacyId(supplier)
}

export async function updateSupplier(id: string, data: Partial<typeof suppliers.$inferInsert>) {
    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1)
    if (!existing) throw new AppError('Supplier not found', 404)

    const payload = { ...data }
    if (payload.contact) {
        payload.contact = assertValidWhatsAppContact(payload.contact, 'Contact')
    }

    const [supplier] = await db
        .update(suppliers)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(suppliers.id, id))
        .returning()

    return withLegacyId(supplier)
}

export async function listSuppliers() {
    const [rows, orderRows, txnRows] = await Promise.all([
        db.select().from(suppliers).orderBy(desc(suppliers.createdAt)),
        db
            .select({
                supplierId: restockOrders.supplierId,
                status: restockOrders.status,
                totalAmount: restockOrders.totalAmount,
                amountPaid: restockOrders.amountPaid
            })
            .from(restockOrders),
        db
            .select({
                supplierId: supplierTransactions.supplierId,
                restockOrderId: supplierTransactions.restockOrderId,
                type: supplierTransactions.type,
                amount: supplierTransactions.amount
            })
            .from(supplierTransactions)
    ])

    const ordersBySupplier = new Map()
    for (const order of orderRows) {
        const list = ordersBySupplier.get(order.supplierId) ?? []
        list.push(order)
        ordersBySupplier.set(order.supplierId, list)
    }
    const txnsBySupplier = new Map()
    for (const txn of txnRows) {
        const list = txnsBySupplier.get(txn.supplierId) ?? []
        list.push(txn)
        txnsBySupplier.set(txn.supplierId, list)
    }

    return Promise.all(
        rows.map(async (supplier) => {
            const linkedProducts = await db
                .select({ product: products, link: supplierProducts })
                .from(supplierProducts)
                .innerJoin(products, eq(supplierProducts.productId, products.id))
                .where(eq(supplierProducts.supplierId, supplier.id))

            const supplierOrders = ordersBySupplier.get(supplier.id) ?? []
            const supplierTxns = txnsBySupplier.get(supplier.id) ?? []

            return {
                ...withLegacyId(supplier),
                payable: computeSupplierPayable(supplierOrders, standaloneSupplierNet(supplierTxns)),
                products: linkedProducts.map(({ product, link }) => ({
                    ...withLegacyId(product),
                    supplierSku: link.supplierSku,
                    unitCost: link.unitCost,
                    isPreferred: link.isPreferred
                }))
            }
        })
    )
}

export async function getSupplierById(id: string) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1)
    if (!supplier) throw new AppError('Supplier not found', 404)

    const linkedProducts = await db
        .select({ product: products, link: supplierProducts })
        .from(supplierProducts)
        .innerJoin(products, eq(supplierProducts.productId, products.id))
        .where(eq(supplierProducts.supplierId, id))

    return {
        ...withLegacyId(supplier),
        payable: await loadSupplierPayable(db, id),
        products: linkedProducts.map(({ product, link }) => ({
            ...withLegacyId(product),
            supplierSku: link.supplierSku,
            unitCost: link.unitCost,
            isPreferred: link.isPreferred
        }))
    }
}

/**
 * Permanently remove a supplier and every supplier-owned purchasing record.
 * Stock already received remains in inventory; only its audit rows are removed.
 */
export async function deleteSupplier(id: string) {
    await db.transaction(async (tx) => {
        const [supplier] = await tx.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, id)).limit(1)
        if (!supplier) throw new AppError('Supplier not found', 404)

        const orders = await tx.select({ id: restockOrders.id }).from(restockOrders).where(eq(restockOrders.supplierId, id))
        const orderIds = orders.map((order) => order.id)
        if (orderIds.length) {
            const items = await tx
                .select({ id: restockOrderItems.id })
                .from(restockOrderItems)
                .where(inArray(restockOrderItems.restockOrderId, orderIds))
            const itemIds = items.map((item) => item.id)
            if (itemIds.length) {
                await tx.delete(productStockHistory).where(inArray(productStockHistory.restockOrderItemId, itemIds))
            }
            await tx.delete(restockOrders).where(inArray(restockOrders.id, orderIds))
        }

        await tx.delete(supplierTransactions).where(eq(supplierTransactions.supplierId, id))
        await tx.delete(suppliers).where(eq(suppliers.id, id))
    })
}

export async function linkSupplierProduct(
    supplierId: string,
    productId: string,
    data: { supplierSku?: string; unitCost?: number; isPreferred?: boolean }
) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!supplier || !product) throw new AppError('Supplier or product not found', 404)

    if (data.isPreferred) {
        await db.update(supplierProducts).set({ isPreferred: false }).where(eq(supplierProducts.productId, productId))
    }

    await db
        .insert(supplierProducts)
        .values({
            supplierId,
            productId,
            supplierSku: data.supplierSku,
            unitCost: data.unitCost,
            isPreferred: data.isPreferred ?? false
        })
        .onConflictDoUpdate({
            target: [supplierProducts.supplierId, supplierProducts.productId],
            set: {
                supplierSku: data.supplierSku,
                unitCost: data.unitCost,
                isPreferred: data.isPreferred ?? false
            }
        })
}

export async function unlinkSupplierProduct(supplierId: string, productId: string) {
    await db.delete(supplierProducts).where(and(eq(supplierProducts.supplierId, supplierId), eq(supplierProducts.productId, productId)))
}

export async function linkSupplierProductsByCategories(
    supplierId: string,
    categoryIds: string[],
    data: { supplierSku?: string; unitCost?: number; isPreferred?: boolean } = {}
) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
    if (!supplier) throw new AppError('Supplier not found', 404)

    const productIds = await getProductIdsForCategories(categoryIds)
    if (!productIds.length) {
        throw new AppError('No products found under the selected categories', 400)
    }

    let linked = 0
    for (const productId of productIds) {
        await linkSupplierProduct(supplierId, productId, data)
        linked += 1
    }

    return { linked, productIds }
}
