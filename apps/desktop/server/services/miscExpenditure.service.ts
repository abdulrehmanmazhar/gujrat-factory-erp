import { asc, count, eq, isNull, sum } from 'drizzle-orm'
import { db, getClient } from '../utils/db.js'
import { miscExpenditureCategories, miscellaneousExpenditures } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { deleteRemoteFile } from '../utils/rclone.js'

export const PAYMENT_MODES = ['cash', 'online'] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export type MiscExpenditureCategoryNode = {
    id: string
    _id: string
    name: string
    parentId: string | null
    sortOrder: number
    path: string
    children: MiscExpenditureCategoryNode[]
    expenditureCount: number
    expenditureTotal: number
    createdAt: Date
    updatedAt: Date
}

function assertPaymentMode(value: string): PaymentMode {
    if (!PAYMENT_MODES.includes(value as PaymentMode)) {
        throw new AppError('Payment mode must be cash or online', 400)
    }
    return value as PaymentMode
}

async function listFlatMiscCategories() {
    return db
        .select()
        .from(miscExpenditureCategories)
        .orderBy(asc(miscExpenditureCategories.sortOrder), asc(miscExpenditureCategories.name))
}

async function assertSiblingNameUnique(name: string, parentId: string | null, excludeId?: string) {
    const siblings =
        parentId == null
            ? await db.select().from(miscExpenditureCategories).where(isNull(miscExpenditureCategories.parentId))
            : await db.select().from(miscExpenditureCategories).where(eq(miscExpenditureCategories.parentId, parentId))

    const conflict = siblings.find((row) => row.id !== excludeId && row.name.toLowerCase() === name.toLowerCase())
    if (conflict) throw new AppError('A category with this name already exists under the same parent', 400)
}

async function getMiscCategoryById(id: string) {
    const [row] = await db.select().from(miscExpenditureCategories).where(eq(miscExpenditureCategories.id, id)).limit(1)
    return row ?? null
}

async function assertMiscCategoryExists(id: string) {
    const category = await getMiscCategoryById(id)
    if (!category) throw new AppError('Category not found', 400)
    return category
}

async function buildMiscCategoryPathMap(rows?: Awaited<ReturnType<typeof listFlatMiscCategories>>) {
    const all = rows ?? (await listFlatMiscCategories())
    const byId = new Map(all.map((row) => [row.id, row]))
    const pathById = new Map<string, string>()

    const resolvePath = (id: string, stack = new Set<string>()): string => {
        if (pathById.has(id)) return pathById.get(id)!
        if (stack.has(id)) return byId.get(id)?.name ?? ''
        const row = byId.get(id)
        if (!row) return ''
        stack.add(id)
        const path = row.parentId ? `${resolvePath(row.parentId, stack)} / ${row.name}` : row.name
        pathById.set(id, path)
        return path
    }

    for (const row of all) resolvePath(row.id)
    return { all, byId, pathById }
}

export async function getDescendantCategoryIds(categoryId: string) {
    const all = await listFlatMiscCategories()
    const childrenByParent = new Map<string | null, string[]>()
    for (const row of all) {
        const key = row.parentId ?? null
        const list = childrenByParent.get(key) ?? []
        list.push(row.id)
        childrenByParent.set(key, list)
    }

    const result = new Set<string>([categoryId])
    const stack = [categoryId]
    while (stack.length) {
        const current = stack.pop()!
        for (const childId of childrenByParent.get(current) ?? []) {
            if (!result.has(childId)) {
                result.add(childId)
                stack.push(childId)
            }
        }
    }
    return [...result]
}

async function wouldCreateCycle(categoryId: string, newParentId: string | null) {
    if (!newParentId) return false
    if (newParentId === categoryId) return true
    const descendants = await getDescendantCategoryIds(categoryId)
    return descendants.includes(newParentId)
}

function toCategoryDto(
    row: typeof miscExpenditureCategories.$inferSelect,
    path: string,
    extras?: { children?: MiscExpenditureCategoryNode[]; expenditureCount?: number; expenditureTotal?: number }
): MiscExpenditureCategoryNode {
    return {
        ...withLegacyId(row),
        parentId: row.parentId ?? null,
        path,
        children: extras?.children ?? [],
        expenditureCount: extras?.expenditureCount ?? 0,
        expenditureTotal: extras?.expenditureTotal ?? 0
    }
}

export async function listMiscExpenditureCategories(): Promise<MiscExpenditureCategoryNode[]> {
    const { all, pathById } = await buildMiscCategoryPathMap()
    const counts = await db
        .select({
            categoryId: miscellaneousExpenditures.categoryId,
            total: count(),
            amount: sum(miscellaneousExpenditures.amount)
        })
        .from(miscellaneousExpenditures)
        .groupBy(miscellaneousExpenditures.categoryId)

    const countByCategoryId = new Map<string, number>()
    const amountByCategoryId = new Map<string, number>()
    for (const row of counts) {
        if (!row.categoryId) continue
        countByCategoryId.set(row.categoryId, Number(row.total) || 0)
        amountByCategoryId.set(row.categoryId, Number(row.amount) || 0)
    }

    const nodes = new Map<string, MiscExpenditureCategoryNode>()
    for (const row of all) {
        nodes.set(row.id, toCategoryDto(row, pathById.get(row.id) ?? row.name))
    }

    const roots: MiscExpenditureCategoryNode[] = []
    for (const node of nodes.values()) {
        if (node.parentId && nodes.has(node.parentId)) {
            nodes.get(node.parentId)!.children.push(node)
        } else {
            roots.push(node)
        }
    }

    const sortRecursive = (items: MiscExpenditureCategoryNode[]) => {
        items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        for (const item of items) sortRecursive(item.children)
    }
    sortRecursive(roots)

    const applySubtreeTotals = (node: MiscExpenditureCategoryNode): { count: number; amount: number } => {
        let countTotal = countByCategoryId.get(node.id) ?? 0
        let amountTotal = amountByCategoryId.get(node.id) ?? 0
        for (const child of node.children) {
            const nested = applySubtreeTotals(child)
            countTotal += nested.count
            amountTotal += nested.amount
        }
        node.expenditureCount = countTotal
        node.expenditureTotal = amountTotal
        return { count: countTotal, amount: amountTotal }
    }
    for (const root of roots) applySubtreeTotals(root)

    return roots
}

export async function createMiscExpenditureCategory(data: { name: string; parentId?: string | null; sortOrder?: number }) {
    const name = data.name.trim()
    if (!name) throw new AppError('Category name is required', 400)

    const parentId = data.parentId?.trim() || null
    if (parentId) await assertMiscCategoryExists(parentId)
    await assertSiblingNameUnique(name, parentId)

    let sortOrder = data.sortOrder
    if (sortOrder == null || !Number.isFinite(sortOrder)) {
        const siblings =
            parentId == null
                ? await db.select().from(miscExpenditureCategories).where(isNull(miscExpenditureCategories.parentId))
                : await db.select().from(miscExpenditureCategories).where(eq(miscExpenditureCategories.parentId, parentId))
        sortOrder = siblings.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
    }

    const [created] = await db
        .insert(miscExpenditureCategories)
        .values({
            id: createId(),
            name,
            parentId,
            sortOrder
        } as typeof miscExpenditureCategories.$inferInsert)
        .returning()

    const { pathById } = await buildMiscCategoryPathMap()
    return toCategoryDto(created, pathById.get(created.id) ?? created.name)
}

export async function updateMiscExpenditureCategory(
    id: string,
    data: { name?: string; parentId?: string | null; sortOrder?: number }
) {
    const existing = await assertMiscCategoryExists(id)
    const name = data.name != null ? data.name.trim() : existing.name
    if (!name) throw new AppError('Category name is required', 400)

    const parentId = data.parentId === undefined ? (existing.parentId ?? null) : data.parentId?.trim() || null
    if (parentId) await assertMiscCategoryExists(parentId)
    if (await wouldCreateCycle(id, parentId)) {
        throw new AppError('Cannot move a category under one of its descendants', 400)
    }
    await assertSiblingNameUnique(name, parentId, id)

    const sortOrder = data.sortOrder != null && Number.isFinite(data.sortOrder) ? data.sortOrder : existing.sortOrder

    const [updated] = await db
        .update(miscExpenditureCategories)
        .set({
            name,
            parentId,
            sortOrder,
            updatedAt: new Date()
        } as Partial<typeof miscExpenditureCategories.$inferInsert> & { updatedAt: Date })
        .where(eq(miscExpenditureCategories.id, id))
        .returning()

    const { pathById } = await buildMiscCategoryPathMap()
    return toCategoryDto(updated, pathById.get(updated.id) ?? updated.name)
}

export async function deleteMiscExpenditureCategory(id: string) {
    await assertMiscCategoryExists(id)

    const [child] = await db.select().from(miscExpenditureCategories).where(eq(miscExpenditureCategories.parentId, id)).limit(1)
    if (child) throw new AppError('Remove or reassign subcategories before deleting this category', 400)

    const [linked] = await db
        .select({ id: miscellaneousExpenditures.id })
        .from(miscellaneousExpenditures)
        .where(eq(miscellaneousExpenditures.categoryId, id))
        .limit(1)
    if (linked) throw new AppError('Reassign expenditures away from this category before deleting it', 400)

    await db.delete(miscExpenditureCategories).where(eq(miscExpenditureCategories.id, id))
}

async function getExpenditureWithCreator(id: string, pathById?: Map<string, string>) {
    const client = getClient()
    const result = await client.execute({
        sql: `
            SELECT
                e.id,
                e.amount,
                e.payment_mode,
                e.note,
                e.category_id,
                e.proof_image,
                e.proof_image_public_id,
                e.created_by_id,
                e.created_at,
                e.updated_at,
                c.id AS category_row_id,
                c.name AS category_name,
                u.id AS creator_id,
                u.name AS creator_name,
                u.contact AS creator_contact,
                u.role AS creator_role
            FROM miscellaneous_expenditures e
            LEFT JOIN misc_expenditure_categories c ON c.id = e.category_id
            LEFT JOIN users u ON u.id = e.created_by_id
            WHERE e.id = ?
            LIMIT 1
        `,
        args: [id]
    })

    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) return null

    const categoryId = row.category_row_id ? String(row.category_row_id) : null
    const categoryName = row.category_name ? String(row.category_name) : ''

    return {
        id: String(row.id),
        _id: String(row.id),
        amount: Number(row.amount),
        paymentMode: String(row.payment_mode) as PaymentMode,
        note: String(row.note),
        categoryId: row.category_id ? String(row.category_id) : null,
        category: categoryId
            ? {
                  id: categoryId,
                  _id: categoryId,
                  name: categoryName,
                  path: pathById?.get(categoryId) ?? categoryName
              }
            : null,
        proofImage: row.proof_image ? String(row.proof_image) : null,
        proofImagePublicId: row.proof_image_public_id ? String(row.proof_image_public_id) : null,
        createdById: String(row.created_by_id),
        createdAt: new Date(Number(row.created_at)).toISOString(),
        updatedAt: new Date(Number(row.updated_at)).toISOString(),
        createdBy: row.creator_id
            ? {
                  id: String(row.creator_id),
                  _id: String(row.creator_id),
                  name: String(row.creator_name),
                  contact: String(row.creator_contact),
                  role: String(row.creator_role),
                  isVerified: true
              }
            : null
    }
}

export async function listMiscellaneousExpenditures() {
    const client = getClient()
    const result = await client.execute({
        sql: `
            SELECT id
            FROM miscellaneous_expenditures
            ORDER BY created_at DESC
        `
    })

    const { pathById } = await buildMiscCategoryPathMap()
    const rows = await Promise.all(
        result.rows.map(async (row) => getExpenditureWithCreator(String((row as unknown as { id: string }).id), pathById))
    )

    return rows.filter(Boolean)
}

export async function createMiscellaneousExpenditure(data: {
    amount: number
    paymentMode: string
    note: string
    categoryId: string
    proofImage?: string
    proofImagePublicId?: string
    createdById: string
}) {
    const amount = Number(data.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Amount must be greater than zero', 400)
    }

    const note = data.note.trim()
    if (!note) {
        throw new AppError('Note is required', 400)
    }

    const categoryId = String(data.categoryId ?? '').trim()
    if (!categoryId) throw new AppError('Category is required', 400)

    await assertMiscCategoryExists(categoryId)

    const paymentMode = assertPaymentMode(data.paymentMode)
    const id = createId()
    const now = Date.now()

    await getClient().execute({
        sql: `
            INSERT INTO miscellaneous_expenditures
            (id, amount, payment_mode, note, category_id, proof_image, proof_image_public_id, created_by_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [id, amount, paymentMode, note, categoryId, data.proofImage ?? null, data.proofImagePublicId ?? null, data.createdById, now, now]
    })

    const { pathById } = await buildMiscCategoryPathMap()
    return getExpenditureWithCreator(id, pathById)
}

export async function deleteMiscellaneousExpenditure(id: string) {
    const existing = await getExpenditureWithCreator(id)
    if (!existing) throw new AppError('Expenditure not found', 404)

    if (existing.proofImagePublicId) {
        await deleteRemoteFile(existing.proofImagePublicId)
    }

    await getClient().execute({
        sql: 'DELETE FROM miscellaneous_expenditures WHERE id = ?',
        args: [id]
    })
}
