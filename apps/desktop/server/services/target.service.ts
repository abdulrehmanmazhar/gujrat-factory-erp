// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { products, targets, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export async function createTarget(userId: string, data: { type: string; value: number; productId?: string; startDate: Date; endDate: Date }) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) throw new AppError('User does not exist', 400)
    if (!data.type || !data.value || !data.startDate || !data.endDate) throw new AppError('Please provide all required fields', 400)

    const [target] = await db
        .insert(targets)
        .values({
            id: createId(),
            userId,
            type: data.type,
            value: data.value,
            productId: data.productId ?? null,
            startDate: data.startDate,
            endDate: data.endDate
        })
        .returning()

    return withLegacyId(target)
}

export async function listTargets() {
    const rows = await db.select().from(targets).orderBy(desc(targets.createdAt))
    return Promise.all(
        rows.map(async (target) => {
            const [user] = await db
                .select({ id: users.id, name: users.name, email: users.email })
                .from(users)
                .where(eq(users.id, target.userId))
                .limit(1)
            const [product] = target.productId
                ? await db
                      .select({ id: products.id, name: products.name, category: products.category })
                      .from(products)
                      .where(eq(products.id, target.productId))
                      .limit(1)
                : [null]

            return {
                ...withLegacyId(target),
                userId: user ? withLegacyId(user) : null,
                productId: product ? withLegacyId(product) : null
            }
        })
    )
}

export async function listTargetsByUser(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) throw new AppError('User does not exist', 400)

    const rows = await db.select().from(targets).where(eq(targets.userId, userId)).orderBy(desc(targets.createdAt))
    return Promise.all(
        rows.map(async (target) => {
            const [product] = target.productId
                ? await db
                      .select({ id: products.id, name: products.name, category: products.category })
                      .from(products)
                      .where(eq(products.id, target.productId))
                      .limit(1)
                : [null]
            return { ...withLegacyId(target), productId: product ? withLegacyId(product) : null }
        })
    )
}

export async function updateTargetProgress(targetId: string, progress: number) {
    const [target] = await db.select().from(targets).where(eq(targets.id, targetId)).limit(1)
    if (!target) throw new AppError('Target not found', 404)

    const [updated] = await db
        .update(targets)
        .set({ progress, achieved: progress >= target.value, updatedAt: new Date() })
        .where(eq(targets.id, targetId))
        .returning()

    return withLegacyId(updated)
}

export async function deleteTarget(targetId: string) {
    const [target] = await db.select().from(targets).where(eq(targets.id, targetId)).limit(1)
    if (!target) throw new AppError('Target not found', 404)
    await db.delete(targets).where(eq(targets.id, targetId))
}
