import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as labourService from '../services/labour.service.js'

export const getLabourers = CatchAsyncError(async (req: Request, res: Response) => {
    const labourers = await labourService.listLabourers()
    httpResponse(req, res, 200, 'Labourers fetched successfully', { labourers })
})

export const getLabourer = CatchAsyncError(async (req: Request, res: Response) => {
    const labourer = await labourService.getLabourer(param(req.params.id))
    httpResponse(req, res, 200, 'Labourer fetched successfully', { labourer })
})

export const createLabourer = CatchAsyncError(async (req: Request, res: Response) => {
    const labourer = await labourService.createLabourer(req.body)
    httpResponse(req, res, 200, 'Labourer created successfully', { labourer })
})

export const updateLabourer = CatchAsyncError(async (req: Request, res: Response) => {
    const labourer = await labourService.updateLabourer(param(req.params.id), req.body)
    httpResponse(req, res, 200, 'Labourer updated successfully', { labourer })
})

export const deleteLabourer = CatchAsyncError(async (req: Request, res: Response) => {
    await labourService.deleteLabourer(param(req.params.id))
    httpResponse(req, res, 200, 'Labourer and all linked records deleted successfully', null)
})

export const setLabourRate = CatchAsyncError(async (req: Request, res: Response) => {
    const { productId, ratePerUnit } = req.body
    if (!productId || ratePerUnit === undefined || ratePerUnit === null || ratePerUnit === '') {
        throw new AppError('productId and ratePerUnit are required', 400)
    }
    const rate = Number(ratePerUnit)
    if (!Number.isFinite(rate)) throw new AppError('Rate must be a valid number', 400)
    const labourer = await labourService.setLabourRate(param(req.params.id), productId, rate)
    httpResponse(req, res, 200, 'Labour rate saved', { labourer })
})

export const setLabourRatesByCategories = CatchAsyncError(async (req: Request, res: Response) => {
    const { categoryIds, ratePerUnit } = req.body
    if (!Array.isArray(categoryIds) || !categoryIds.length) {
        throw new AppError('Select at least one category', 400)
    }
    if (ratePerUnit === undefined || ratePerUnit === null || ratePerUnit === '') {
        throw new AppError('ratePerUnit is required', 400)
    }
    const rate = Number(ratePerUnit)
    if (!Number.isFinite(rate)) throw new AppError('Rate must be a valid number', 400)
    const result = await labourService.setLabourRatesByCategories(param(req.params.id), categoryIds, rate)
    httpResponse(req, res, 200, `Saved rate for ${result.updated} product(s)`, result)
})

export const removeLabourRate = CatchAsyncError(async (req: Request, res: Response) => {
    const labourer = await labourService.removeLabourRate(param(req.params.id), param(req.params.productId))
    httpResponse(req, res, 200, 'Labour rate removed', { labourer })
})

export const recordProduction = CatchAsyncError(async (req: Request, res: Response) => {
    const { labourerId, productId, qtyProduced, notes } = req.body
    if (!labourerId || !productId || qtyProduced === undefined) {
        throw new AppError('labourerId, productId, and qtyProduced are required', 400)
    }
    const entry = await labourService.recordProduction(labourerId, productId, Number(qtyProduced), req.user!.id, notes)
    httpResponse(req, res, 200, 'Production recorded successfully', { entry })
})

export const getProductionEntries = CatchAsyncError(async (req: Request, res: Response) => {
    const entries = await labourService.listProductionEntries()
    httpResponse(req, res, 200, 'Production entries fetched successfully', { entries })
})

export const getProductionEntry = CatchAsyncError(async (req: Request, res: Response) => {
    const entry = await labourService.getProductionEntry(param(req.params.id))
    httpResponse(req, res, 200, 'Production entry fetched successfully', { entry })
})

export const getLabourTransactions = CatchAsyncError(async (req: Request, res: Response) => {
    const labourerId = typeof req.query.labourerId === 'string' ? req.query.labourerId : undefined
    const transactions = await labourService.listLabourTransactions(labourerId)
    httpResponse(req, res, 200, 'Labour transactions fetched successfully', { transactions })
})

export const createLabourTransaction = CatchAsyncError(async (req: Request, res: Response) => {
    const { labourerId, amount, category, description } = req.body
    if (!labourerId || amount === undefined || !category || !description) {
        throw new AppError('labourerId, amount, category, and description are required', 400)
    }
    const transaction = await labourService.createLabourTransaction(labourerId, Number(amount), category, description, req.user!.id)
    httpResponse(req, res, 200, 'Labour transaction recorded successfully', { transaction })
})

export const deleteLabourTransaction = CatchAsyncError(async (req: Request, res: Response) => {
    await labourService.deleteLabourTransaction(param(req.params.id))
    httpResponse(req, res, 200, 'Labour transaction removed successfully', null)
})
