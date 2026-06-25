// @ts-nocheck
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { labourProductionConsumption, labourProductionEntries, labourRates, labourerTransactions, labourers, products } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { assertValidWhatsAppContact } from '../utils/phone.js'
import { adjustInventoryQty } from './product.service.js'
import { getRecipeByOutputProduct } from './recipe.service.js'

export const MANUAL_LABOUR_CATEGORIES = ['advance', 'bonus', 'expense', 'other'] as const
export type ManualLabourCategory = (typeof MANUAL_LABOUR_CATEGORIES)[number]

async function getLabourerTransactionWithDetails(transactionId: string) {
    const [txn] = await db.select().from(labourerTransactions).where(eq(labourerTransactions.id, transactionId)).limit(1)
    if (!txn) return null

    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, txn.labourerId)).limit(1)

    return {
        ...withLegacyId(txn),
        labourCategory: txn.category,
        labourer: labourer ? withLegacyId(labourer) : null
    }
}

async function getLabourerWithRates(labourerId: string) {
    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, labourerId)).limit(1)
    if (!labourer) return null

    const rates = await db
        .select({ rate: labourRates, product: products })
        .from(labourRates)
        .innerJoin(products, eq(labourRates.productId, products.id))
        .where(eq(labourRates.labourerId, labourerId))

    return {
        ...withLegacyId(labourer),
        rates: rates.map(({ rate, product }) => ({
            productId: rate.productId,
            ratePerUnit: rate.ratePerUnit,
            product: withLegacyId(product)
        }))
    }
}

async function getProductionEntryWithDetails(entryId: string) {
    const [entry] = await db.select().from(labourProductionEntries).where(eq(labourProductionEntries.id, entryId)).limit(1)
    if (!entry) return null

    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, entry.labourerId)).limit(1)
    const [product] = await db.select().from(products).where(eq(products.id, entry.productId)).limit(1)
    const consumption = await db
        .select({ row: labourProductionConsumption, product: products })
        .from(labourProductionConsumption)
        .innerJoin(products, eq(labourProductionConsumption.productId, products.id))
        .where(eq(labourProductionConsumption.entryId, entryId))

    return {
        ...withLegacyId(entry),
        labourer: labourer ? withLegacyId(labourer) : null,
        product: product ? withLegacyId(product) : null,
        consumption: consumption.map(({ row, product: p }) => ({
            ...withLegacyId(row),
            product: withLegacyId(p)
        }))
    }
}

export async function createLabourer(data: { name: string; contact?: string; notes?: string }) {
    const contact = data.contact?.trim() ? assertValidWhatsAppContact(data.contact, 'Contact') : null
    const [labourer] = await db
        .insert(labourers)
        .values({
            id: createId(),
            name: data.name,
            contact,
            notes: data.notes
        })
        .returning()
    return withLegacyId(labourer)
}

export async function updateLabourer(id: string, data: Partial<{ name: string; contact: string; notes: string; isActive: boolean }>) {
    const [existing] = await db.select().from(labourers).where(eq(labourers.id, id)).limit(1)
    if (!existing) throw new AppError('Labourer not found', 404)

    const payload = { ...data }
    if (payload.contact !== undefined) {
        payload.contact = payload.contact?.trim() ? assertValidWhatsAppContact(payload.contact, 'Contact') : null
    }

    await db
        .update(labourers)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(labourers.id, id))

    return getLabourerWithRates(id)
}

export async function listLabourers(includeInactive = false) {
    const rows = includeInactive
        ? await db.select().from(labourers).orderBy(desc(labourers.createdAt))
        : await db.select().from(labourers).where(eq(labourers.isActive, true)).orderBy(desc(labourers.createdAt))

    return Promise.all(rows.map((r) => getLabourerWithRates(r.id)))
}

export async function getLabourer(id: string) {
    const labourer = await getLabourerWithRates(id)
    if (!labourer) throw new AppError('Labourer not found', 404)
    return labourer
}

export async function setLabourRate(labourerId: string, productId: string, ratePerUnit: number) {
    if (ratePerUnit < 0) throw new AppError('Rate must be non-negative', 400)

    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, labourerId)).limit(1)
    if (!labourer) throw new AppError('Labourer not found', 404)

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw new AppError('Product not found', 404)

    await db
        .insert(labourRates)
        .values({ labourerId, productId, ratePerUnit })
        .onConflictDoUpdate({
            target: [labourRates.labourerId, labourRates.productId],
            set: { ratePerUnit, updatedAt: new Date() }
        })

    return getLabourer(labourerId)
}

export async function removeLabourRate(labourerId: string, productId: string) {
    await db.delete(labourRates).where(and(eq(labourRates.labourerId, labourerId), eq(labourRates.productId, productId)))
    return getLabourer(labourerId)
}

export async function recordProduction(labourerId: string, productId: string, qtyProduced: number, createdById: string, notes?: string) {
    if (qtyProduced <= 0) throw new AppError('Quantity produced must be positive', 400)

    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, labourerId)).limit(1)
    if (!labourer) throw new AppError('Labourer not found', 404)
    if (!labourer.isActive) throw new AppError('Labourer is inactive', 400)

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw new AppError('Product not found', 404)

    const [rateRow] = await db
        .select()
        .from(labourRates)
        .where(and(eq(labourRates.labourerId, labourerId), eq(labourRates.productId, productId)))
        .limit(1)
    if (!rateRow) throw new AppError('No labour rate defined for this worker and product', 400)

    const recipe = await getRecipeByOutputProduct(productId)
    const consumptionPlan: { productId: string; qty: number }[] = []

    if (recipe?.items?.length) {
        for (const item of recipe.items) {
            const needed = item.qty * qtyProduced
            const [ing] = await db.select().from(products).where(eq(products.id, item.ingredientProductId)).limit(1)
            if (!ing) throw new AppError(`Ingredient not found: ${item.ingredientProductId}`, 404)
            if (ing.stockQty < needed) {
                throw new AppError(`Insufficient ${ing.name} for production. Need ${needed}, have ${ing.stockQty}`, 400)
            }
            consumptionPlan.push({ productId: item.ingredientProductId, qty: needed })
        }
    }

    const entryId = createId()
    const ratePerUnit = rateRow.ratePerUnit
    const totalPay = ratePerUnit * qtyProduced
    const labourerTransactionId = totalPay > 0 ? createId() : null

    for (const { productId: ingId, qty } of consumptionPlan) {
        await adjustInventoryQty(ingId, -qty)
    }

    await adjustInventoryQty(productId, qtyProduced)

    if (labourerTransactionId) {
        await db.insert(labourerTransactions).values({
            id: labourerTransactionId,
            labourerId,
            category: 'production',
            amount: totalPay,
            description: `Labour: ${labourer.name} produced ${qtyProduced} × ${product.name}`,
            createdById
        })
    }

    await db.insert(labourProductionEntries).values({
        id: entryId,
        labourerId,
        productId,
        qtyProduced,
        ratePerUnit,
        totalPay,
        recipeApplied: consumptionPlan.length > 0,
        labourerTransactionId,
        notes,
        createdById
    })

    for (const { productId: ingId, qty } of consumptionPlan) {
        await db.insert(labourProductionConsumption).values({
            id: createId(),
            entryId,
            productId: ingId,
            qtyConsumed: qty
        })
    }

    return getProductionEntryWithDetails(entryId)
}

export async function listLabourTransactions(labourerId?: string) {
    const filter = labourerId ? eq(labourerTransactions.labourerId, labourerId) : undefined
    const rows = filter
        ? await db.select().from(labourerTransactions).where(filter).orderBy(desc(labourerTransactions.createdAt))
        : await db.select().from(labourerTransactions).orderBy(desc(labourerTransactions.createdAt))

    return Promise.all(rows.map((r) => getLabourerTransactionWithDetails(r.id)))
}

export async function createLabourTransaction(
    labourerId: string,
    amount: number,
    category: ManualLabourCategory,
    description: string,
    createdById: string
) {
    if (amount <= 0) throw new AppError('Amount must be positive', 400)
    if (!MANUAL_LABOUR_CATEGORIES.includes(category)) {
        throw new AppError('Invalid labour transaction category', 400)
    }
    if (!description?.trim()) throw new AppError('Description is required', 400)

    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, labourerId)).limit(1)
    if (!labourer) throw new AppError('Labourer not found', 404)

    const transactionId = createId()
    await db.insert(labourerTransactions).values({
        id: transactionId,
        labourerId,
        category,
        amount,
        description: description.trim(),
        createdById
    })

    const txn = await getLabourerTransactionWithDetails(transactionId)
    if (!txn) throw new AppError('Failed to create transaction', 500)
    return txn
}

export async function deleteLabourTransaction(id: string) {
    const [txn] = await db.select().from(labourerTransactions).where(eq(labourerTransactions.id, id)).limit(1)
    if (!txn) throw new AppError('Transaction not found', 404)
    if (txn.category === 'production') {
        throw new AppError('Production pay transactions cannot be deleted here', 400)
    }

    await db.delete(labourerTransactions).where(eq(labourerTransactions.id, id))
}

export async function listProductionEntries() {
    const entries = await db.select().from(labourProductionEntries).orderBy(desc(labourProductionEntries.createdAt))
    return Promise.all(entries.map((e) => getProductionEntryWithDetails(e.id)))
}

export async function getProductionEntry(id: string) {
    const entry = await getProductionEntryWithDetails(id)
    if (!entry) throw new AppError('Production entry not found', 404)
    return entry
}
