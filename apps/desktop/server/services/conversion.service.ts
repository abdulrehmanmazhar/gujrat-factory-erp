// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { productConversions, products, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { adjustInventoryQty, getProductById } from './product.service.js'

export type CreateConversionInput = {
    inputProductId: string
    outputProductId: string
    inputRatio: number
    outputRatio: number
    /** Provide exactly one of these; the other is computed from the ratio. */
    inputQty?: number
    outputQty?: number
    notes?: string
    createdById: string
}

function assertPositiveNumber(value: unknown, label: string) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) throw new AppError(`${label} must be a positive number`, 400)
    return n
}

export function resolveConversionAmounts(inputRatio: number, outputRatio: number, inputQty?: number, outputQty?: number) {
    const hasInput = inputQty !== undefined && inputQty !== null && String(inputQty) !== ''
    const hasOutput = outputQty !== undefined && outputQty !== null && String(outputQty) !== ''

    if (hasInput === hasOutput) {
        throw new AppError('Provide either input quantity or output quantity (not both)', 400)
    }

    if (hasInput) {
        const inQty = Math.round(assertPositiveNumber(inputQty, 'Input quantity'))
        const outQty = Math.round((inQty * outputRatio) / inputRatio)
        if (outQty <= 0) throw new AppError('Conversion yields zero output; increase the quantity', 400)
        return { inputQty: inQty, outputQty: outQty }
    }

    const outQty = Math.round(assertPositiveNumber(outputQty, 'Output quantity'))
    const inQty = Math.round((outQty * inputRatio) / outputRatio)
    if (inQty <= 0) throw new AppError('Conversion requires zero input; increase the quantity', 400)
    return { inputQty: inQty, outputQty: outQty }
}

async function hydrateConversion(row: typeof productConversions.$inferSelect) {
    const [inputProduct] = await db.select().from(products).where(eq(products.id, row.inputProductId)).limit(1)
    const [outputProduct] = await db.select().from(products).where(eq(products.id, row.outputProductId)).limit(1)
    const [createdByUser] = await db
        .select({ id: users.id, name: users.name, contact: users.contact })
        .from(users)
        .where(eq(users.id, row.createdById))
        .limit(1)

    return {
        ...withLegacyId(row),
        inputProduct: inputProduct ? withLegacyId(inputProduct) : null,
        outputProduct: outputProduct ? withLegacyId(outputProduct) : null,
        createdByUser: createdByUser ? withLegacyId(createdByUser) : null
    }
}

export async function listConversions() {
    const rows = await db.select().from(productConversions).orderBy(desc(productConversions.createdAt))
    return Promise.all(rows.map((row) => hydrateConversion(row)))
}

export async function getConversionById(id: string) {
    const [row] = await db.select().from(productConversions).where(eq(productConversions.id, id)).limit(1)
    if (!row) throw new AppError('Conversion not found', 404)
    return hydrateConversion(row)
}

export async function createConversion(data: CreateConversionInput) {
    const inputRatio = assertPositiveNumber(data.inputRatio, 'Input ratio')
    const outputRatio = assertPositiveNumber(data.outputRatio, 'Output ratio')

    if (data.inputProductId === data.outputProductId) {
        throw new AppError('Input and output products must be different', 400)
    }

    const inputProduct = await getProductById(data.inputProductId)
    if (!inputProduct) throw new AppError('Input product not found', 404)
    const outputProduct = await getProductById(data.outputProductId)
    if (!outputProduct) throw new AppError('Output product not found', 404)

    const { inputQty, outputQty } = resolveConversionAmounts(inputRatio, outputRatio, data.inputQty, data.outputQty)

    if (inputProduct.stockQty < inputQty) {
        throw new AppError(`Insufficient stock for ${inputProduct.name}. Available: ${inputProduct.stockQty}`, 400)
    }

    const id = createId()

    await adjustInventoryQty(data.inputProductId, -inputQty)
    try {
        await adjustInventoryQty(data.outputProductId, outputQty)
    } catch (error) {
        await adjustInventoryQty(data.inputProductId, inputQty)
        throw error
    }

    const [row] = await db
        .insert(productConversions)
        .values({
            id,
            inputProductId: data.inputProductId,
            outputProductId: data.outputProductId,
            inputRatio,
            outputRatio,
            inputQty,
            outputQty,
            notes: data.notes?.trim() || null,
            createdById: data.createdById
        })
        .returning()

    return hydrateConversion(row)
}

/** Undo a conversion: reverse stock and delete the record. */
export async function undoConversion(id: string) {
    const [row] = await db.select().from(productConversions).where(eq(productConversions.id, id)).limit(1)
    if (!row) throw new AppError('Conversion not found', 404)

    const outputProduct = await getProductById(row.outputProductId)
    if (!outputProduct) throw new AppError('Output product not found', 404)
    if (outputProduct.stockQty < row.outputQty) {
        throw new AppError(`Cannot undo: ${outputProduct.name} stock is ${outputProduct.stockQty}, but conversion added ${row.outputQty}`, 400)
    }

    await adjustInventoryQty(row.outputProductId, -row.outputQty)
    try {
        await adjustInventoryQty(row.inputProductId, row.inputQty)
    } catch (error) {
        await adjustInventoryQty(row.outputProductId, row.outputQty)
        throw error
    }

    await db.delete(productConversions).where(eq(productConversions.id, id))
    return { id }
}
