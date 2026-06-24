// @ts-nocheck
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { labourProductionConsumption, labourProductionEntries, labourRates, labourers, products, transactions } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { adjustInventoryQty } from './product.service.js'
import { getRecipeByOutputProduct } from './recipe.service.js'

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
    const [labourer] = await db
        .insert(labourers)
        .values({
            id: createId(),
            name: data.name,
            contact: data.contact,
            notes: data.notes
        })
        .returning()
    return withLegacyId(labourer)
}

export async function updateLabourer(id: string, data: Partial<{ name: string; contact: string; notes: string; isActive: boolean }>) {
    const [existing] = await db.select().from(labourers).where(eq(labourers.id, id)).limit(1)
    if (!existing) throw new AppError('Labourer not found', 404)

    await db
        .update(labourers)
        .set({ ...data, updatedAt: new Date() })
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

    for (const { productId: ingId, qty } of consumptionPlan) {
        await adjustInventoryQty(ingId, -qty)
    }

    await adjustInventoryQty(productId, qtyProduced)

    await db.insert(labourProductionEntries).values({
        id: entryId,
        labourerId,
        productId,
        qtyProduced,
        ratePerUnit,
        totalPay,
        recipeApplied: consumptionPlan.length > 0,
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

    if (totalPay > 0) {
        await db.insert(transactions).values({
            id: createId(),
            type: 'labour',
            amount: totalPay,
            description: `Labour: ${labourer.name} produced ${qtyProduced} × ${product.name}`,
            createdById
        })
    }

    return getProductionEntryWithDetails(entryId)
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
