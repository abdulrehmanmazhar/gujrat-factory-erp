// @ts-nocheck
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { categories, productCategories, products, units } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export type StockByUnit = {
    unitId: string | null
    unitName: string
    qty: number
}

export type CategoryNode = {
    id: string
    _id: string
    name: string
    parentId: string | null
    sortOrder: number
    path: string
    children: CategoryNode[]
    productCount: number
    stockByUnit: StockByUnit[]
}

type LinkedProductStock = {
    productId: string
    stockQty: number
    unitId: string | null
    unitName: string
}

function addStockByUnit(map: Map<string, StockByUnit>, unitId: string | null, unitName: string, qty: number) {
    const name = unitName.trim() || 'pcs'
    const key = unitId || name
    const existing = map.get(key)
    if (existing) existing.qty += qty
    else map.set(key, { unitId, unitName: name, qty })
}

function stockMapToList(map: Map<string, StockByUnit>): StockByUnit[] {
    return [...map.values()].sort((a, b) => a.unitName.localeCompare(b.unitName))
}

async function listFlatCategories() {
    return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
}

async function assertSiblingNameUnique(name: string, parentId: string | null, excludeId?: string) {
    const siblings =
        parentId == null
            ? await db
                  .select()
                  .from(categories)
                  .where(and(isNull(categories.parentId), eq(categories.name, name)))
            : await db
                  .select()
                  .from(categories)
                  .where(and(eq(categories.parentId, parentId), eq(categories.name, name)))

    const conflict = siblings.find((row) => row.id !== excludeId)
    if (conflict) throw new AppError('A category with this name already exists under the same parent', 400)
}

export async function getCategoryById(id: string) {
    const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
    return row ? withLegacyId(row) : null
}

export async function assertCategoryExists(id: string) {
    const category = await getCategoryById(id)
    if (!category) throw new AppError('Category not found', 400)
    return category
}

export async function buildCategoryPathMap(rows?: Awaited<ReturnType<typeof listFlatCategories>>) {
    const all = rows ?? (await listFlatCategories())
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

export async function listCategoryTree(): Promise<CategoryNode[]> {
    const { all, pathById } = await buildCategoryPathMap()
    const links = await db
        .select({
            categoryId: productCategories.categoryId,
            productId: productCategories.productId,
            stockQty: products.stockQty,
            unitId: products.unitId,
            unitName: units.name
        })
        .from(productCategories)
        .innerJoin(products, eq(productCategories.productId, products.id))
        .leftJoin(units, eq(products.unitId, units.id))

    const productsByCategoryId = new Map<string, Map<string, LinkedProductStock>>()
    for (const link of links) {
        let bucket = productsByCategoryId.get(link.categoryId)
        if (!bucket) {
            bucket = new Map()
            productsByCategoryId.set(link.categoryId, bucket)
        }
        bucket.set(link.productId, {
            productId: link.productId,
            stockQty: Number(link.stockQty) || 0,
            unitId: link.unitId ?? null,
            unitName: link.unitName?.trim() || 'pcs'
        })
    }

    const nodes = new Map<string, CategoryNode>()
    for (const row of all) {
        nodes.set(row.id, {
            ...withLegacyId(row),
            parentId: row.parentId ?? null,
            path: pathById.get(row.id) ?? row.name,
            children: [],
            productCount: 0,
            stockByUnit: []
        })
    }

    const roots: CategoryNode[] = []
    for (const node of nodes.values()) {
        if (node.parentId && nodes.has(node.parentId)) {
            nodes.get(node.parentId)!.children.push(node)
        } else {
            roots.push(node)
        }
    }

    const sortRecursive = (items: CategoryNode[]) => {
        items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        for (const item of items) sortRecursive(item.children)
    }
    sortRecursive(roots)

    const applySubtreeTotals = (node: CategoryNode): Map<string, LinkedProductStock> => {
        const combined = new Map(productsByCategoryId.get(node.id) ?? [])
        for (const child of node.children) {
            for (const [productId, stock] of applySubtreeTotals(child)) {
                combined.set(productId, stock)
            }
        }

        const stockMap = new Map<string, StockByUnit>()
        for (const stock of combined.values()) {
            addStockByUnit(stockMap, stock.unitId, stock.unitName, stock.stockQty)
        }

        node.productCount = combined.size
        node.stockByUnit = stockMapToList(stockMap)
        return combined
    }

    for (const root of roots) applySubtreeTotals(root)
    return roots
}

export async function getDescendantCategoryIds(categoryId: string) {
    const all = await listFlatCategories()
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

export async function createCategory(data: { name: string; parentId?: string | null; sortOrder?: number }) {
    const name = data.name.trim()
    if (!name) throw new AppError('Category name is required', 400)

    const parentId = data.parentId?.trim() || null
    if (parentId) await assertCategoryExists(parentId)
    await assertSiblingNameUnique(name, parentId)

    let sortOrder = data.sortOrder
    if (sortOrder == null || !Number.isFinite(sortOrder)) {
        const siblings =
            parentId == null
                ? await db.select().from(categories).where(isNull(categories.parentId))
                : await db.select().from(categories).where(eq(categories.parentId, parentId))
        sortOrder = siblings.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
    }

    const [created] = await db
        .insert(categories)
        .values({
            id: createId(),
            name,
            parentId,
            sortOrder
        })
        .returning()

    const { pathById } = await buildCategoryPathMap()
    return {
        ...withLegacyId(created),
        parentId: created.parentId ?? null,
        path: pathById.get(created.id) ?? created.name
    }
}

export async function updateCategory(id: string, data: { name?: string; parentId?: string | null; sortOrder?: number }) {
    const existing = await assertCategoryExists(id)
    const name = data.name != null ? data.name.trim() : existing.name
    if (!name) throw new AppError('Category name is required', 400)

    const parentId = data.parentId === undefined ? (existing.parentId ?? null) : data.parentId?.trim() || null
    if (parentId) await assertCategoryExists(parentId)
    if (await wouldCreateCycle(id, parentId)) {
        throw new AppError('Cannot move a category under one of its descendants', 400)
    }
    await assertSiblingNameUnique(name, parentId, id)

    const sortOrder = data.sortOrder != null && Number.isFinite(data.sortOrder) ? data.sortOrder : existing.sortOrder

    const [updated] = await db
        .update(categories)
        .set({
            name,
            parentId,
            sortOrder,
            updatedAt: new Date()
        })
        .where(eq(categories.id, id))
        .returning()

    const { pathById } = await buildCategoryPathMap()
    return {
        ...withLegacyId(updated),
        parentId: updated.parentId ?? null,
        path: pathById.get(updated.id) ?? updated.name
    }
}

export async function deleteCategory(id: string) {
    await assertCategoryExists(id)

    const [child] = await db.select().from(categories).where(eq(categories.parentId, id)).limit(1)
    if (child) throw new AppError('Remove or reassign subcategories before deleting this category', 400)

    const [link] = await db.select().from(productCategories).where(eq(productCategories.categoryId, id)).limit(1)
    if (link) throw new AppError('Reassign products away from this category before deleting it', 400)

    await db.delete(categories).where(eq(categories.id, id))
}

export async function assertCategoriesExist(categoryIds: string[]) {
    const uniqueIds = [...new Set(categoryIds.filter(Boolean))]
    if (!uniqueIds.length) return []

    const rows = await db.select().from(categories)
    const byId = new Map(rows.map((row) => [row.id, row]))
    for (const id of uniqueIds) {
        if (!byId.has(id)) throw new AppError(`Category not found: ${id}`, 400)
    }
    return uniqueIds
}

/** Resolve all product IDs linked to the given categories or any of their descendants. */
export async function getProductIdsForCategories(categoryIds: string[]) {
    const roots = await assertCategoriesExist(categoryIds)
    if (!roots.length) return []

    const expanded = new Set<string>()
    for (const rootId of roots) {
        for (const id of await getDescendantCategoryIds(rootId)) {
            expanded.add(id)
        }
    }

    const links = await db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .where(inArray(productCategories.categoryId, [...expanded]))

    return [...new Set(links.map((link) => link.productId))]
}
