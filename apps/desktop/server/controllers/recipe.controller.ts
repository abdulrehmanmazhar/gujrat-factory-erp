import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as recipeService from '../services/recipe.service.js'

export const getRecipes = CatchAsyncError(async (req: Request, res: Response) => {
    const recipes = await recipeService.listRecipes()
    httpResponse(req, res, 200, 'Recipes fetched successfully', { recipes })
})

export const getRecipe = CatchAsyncError(async (req: Request, res: Response) => {
    const recipe = await recipeService.getRecipeById(param(req.params.id))
    httpResponse(req, res, 200, 'Recipe fetched successfully', { recipe })
})

export const createRecipe = CatchAsyncError(async (req: Request, res: Response) => {
    const { outputProductId, items, notes } = req.body
    if (!outputProductId || !Array.isArray(items)) {
        throw new AppError('outputProductId and items are required', 400)
    }
    const recipe = await recipeService.createRecipe(outputProductId, items, notes)
    httpResponse(req, res, 200, 'Recipe created successfully', { recipe })
})

export const updateRecipe = CatchAsyncError(async (req: Request, res: Response) => {
    const { items, notes } = req.body
    if (!Array.isArray(items)) throw new AppError('items array is required', 400)
    const recipe = await recipeService.updateRecipe(param(req.params.id), items, notes)
    httpResponse(req, res, 200, 'Recipe updated successfully', { recipe })
})

export const deleteRecipe = CatchAsyncError(async (req: Request, res: Response) => {
    await recipeService.deleteRecipe(param(req.params.id))
    httpResponse(req, res, 200, 'Recipe deleted successfully', null)
})
