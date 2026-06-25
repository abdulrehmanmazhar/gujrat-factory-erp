// @ts-nocheck
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { products, supplierProducts, suppliers } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { assertValidWhatsAppContact } from '../utils/phone.js'

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

export async function listSuppliers(includeInactive = false) {
    const rows = includeInactive
        ? await db.select().from(suppliers).orderBy(desc(suppliers.createdAt))
        : await db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(desc(suppliers.createdAt))

    return Promise.all(
        rows.map(async (supplier) => {
            const linkedProducts = await db
                .select({ product: products, link: supplierProducts })
                .from(supplierProducts)
                .innerJoin(products, eq(supplierProducts.productId, products.id))
                .where(eq(supplierProducts.supplierId, supplier.id))

            return {
                ...withLegacyId(supplier),
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
        products: linkedProducts.map(({ product, link }) => ({
            ...withLegacyId(product),
            supplierSku: link.supplierSku,
            unitCost: link.unitCost,
            isPreferred: link.isPreferred
        }))
    }
}

export async function deactivateSupplier(id: string) {
    const [supplier] = await db.update(suppliers).set({ isActive: false, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning()
    if (!supplier) throw new AppError('Supplier not found', 404)
    return withLegacyId(supplier)
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
