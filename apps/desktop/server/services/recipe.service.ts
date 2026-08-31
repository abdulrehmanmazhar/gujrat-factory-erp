// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { products, recipeItems, recipes } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { getProductById } from './product.service.js'

type RecipeItemInput = { ingredientProductId: string; qty: number }

async function getRecipeWithItems(recipeId: string) {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1)
    if (!recipe) return null

    const [outputProduct] = await db.select().from(products).where(eq(products.id, recipe.outputProductId)).limit(1)
    const items = await db
        .select({ item: recipeItems, product: products })
        .from(recipeItems)
        .innerJoin(products, eq(recipeItems.ingredientProductId, products.id))
        .where(eq(recipeItems.recipeId, recipeId))

    return {
        ...withLegacyId(recipe),
        outputProduct: outputProduct ? withLegacyId(outputProduct) : null,
        items: items.map(({ item, product }) => ({
            ...withLegacyId(item),
            ingredientProductId: item.ingredientProductId,
            qty: item.qty,
            product: withLegacyId(product)
        }))
    }
}

export async function listRecipes() {
    const all = await db.select().from(recipes).orderBy(desc(recipes.createdAt))
    return Promise.all(all.map((r) => getRecipeWithItems(r.id)))
}

export async function getRecipeById(id: string) {
    const recipe = await getRecipeWithItems(id)
    if (!recipe) throw new AppError('Recipe not found', 404)
    return recipe
}

export async function getRecipeByOutputProduct(outputProductId: string) {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.outputProductId, outputProductId)).limit(1)
    if (!recipe) return null
    return getRecipeWithItems(recipe.id)
}

export async function createRecipe(outputProductId: string, items: RecipeItemInput[], notes?: string) {
    const output = await getProductById(outputProductId)
    if (!output) throw new AppError('Output product not found', 404)
    if (!items.length) throw new AppError('At least one ingredient is required', 400)

    const existing = await getRecipeByOutputProduct(outputProductId)
    if (existing) throw new AppError('A recipe already exists for this product', 400)

    for (const item of items) {
        if (item.qty <= 0) throw new AppError('Ingredient quantity must be positive', 400)
        if (item.ingredientProductId === outputProductId) {
            throw new AppError('Output product cannot be its own ingredient', 400)
        }
        const ing = await getProductById(item.ingredientProductId)
        if (!ing) throw new AppError('Ingredient product not found', 404)
    }

    const recipeId = createId()
    await db.insert(recipes).values({ id: recipeId, outputProductId, notes })

    for (const item of items) {
        await db.insert(recipeItems).values({
            id: createId(),
            recipeId,
            ingredientProductId: item.ingredientProductId,
            qty: item.qty
        })
    }

    return getRecipeById(recipeId)
}

export async function updateRecipe(id: string, items: RecipeItemInput[], notes?: string) {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1)
    if (!recipe) throw new AppError('Recipe not found', 404)
    if (!items.length) throw new AppError('At least one ingredient is required', 400)

    for (const item of items) {
        if (item.qty <= 0) throw new AppError('Ingredient quantity must be positive', 400)
        if (item.ingredientProductId === recipe.outputProductId) {
            throw new AppError('Output product cannot be its own ingredient', 400)
        }
        const ing = await getProductById(item.ingredientProductId)
        if (!ing) throw new AppError('Ingredient product not found', 404)
    }

    await db.delete(recipeItems).where(eq(recipeItems.recipeId, id))
    for (const item of items) {
        await db.insert(recipeItems).values({
            id: createId(),
            recipeId: id,
            ingredientProductId: item.ingredientProductId,
            qty: item.qty
        })
    }

    await db.update(recipes).set({ notes, updatedAt: new Date() }).where(eq(recipes.id, id))
    return getRecipeById(id)
}

export async function deleteRecipe(id: string) {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1)
    if (!recipe) throw new AppError('Recipe not found', 404)
    await db.delete(recipes).where(eq(recipes.id, id))
}
