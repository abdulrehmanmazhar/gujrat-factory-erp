// @ts-nocheck
import { asc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { units } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export async function listUnits() {
    const rows = await db.select().from(units).orderBy(asc(units.name))
    return rows.map(withLegacyId)
}

export async function createUnit(name: string) {
    const trimmed = name.trim()
    if (!trimmed) throw new AppError('Unit name is required', 400)

    const [existing] = await db.select().from(units).where(eq(units.name, trimmed)).limit(1)
    if (existing) throw new AppError('Unit already exists', 400)

    const [unit] = await db
        .insert(units)
        .values({
            id: createId(),
            name: trimmed
        })
        .returning()

    return withLegacyId(unit)
}

export async function getUnitById(id: string) {
    const [unit] = await db.select().from(units).where(eq(units.id, id)).limit(1)
    return unit ? withLegacyId(unit) : null
}

export async function assertUnitExists(unitId: string) {
    const unit = await getUnitById(unitId)
    if (!unit) throw new AppError('Unit not found', 400)
    return unit
}
