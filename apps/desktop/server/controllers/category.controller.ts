import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as categoryService from '../services/category.service.js'

export const getCategories = CatchAsyncError(async (req: Request, res: Response) => {
    const categories = await categoryService.listCategoryTree()
    httpResponse(req, res, 200, 'Categories fetched successfully', { categories })
})

export const createCategory = CatchAsyncError(async (req: Request, res: Response) => {
    const name = typeof req.body.name === 'string' ? req.body.name : ''
    if (!name.trim()) throw new AppError('Category name is required', 400)
    const parentId = typeof req.body.parentId === 'string' ? req.body.parentId : (req.body.parentId ?? null)
    const category = await categoryService.createCategory({
        name,
        parentId,
        sortOrder: typeof req.body.sortOrder === 'number' ? req.body.sortOrder : undefined
    })
    httpResponse(req, res, 201, 'Category created successfully', { category })
})

export const updateCategory = CatchAsyncError(async (req: Request, res: Response) => {
    const category = await categoryService.updateCategory(param(req.params.id), {
        name: typeof req.body.name === 'string' ? req.body.name : undefined,
        parentId: req.body.parentId === undefined ? undefined : req.body.parentId,
        sortOrder: typeof req.body.sortOrder === 'number' ? req.body.sortOrder : undefined
    })
    httpResponse(req, res, 200, 'Category updated successfully', { category })
})

export const deleteCategory = CatchAsyncError(async (req: Request, res: Response) => {
    await categoryService.deleteCategory(param(req.params.id))
    httpResponse(req, res, 200, 'Category deleted successfully', null)
})
