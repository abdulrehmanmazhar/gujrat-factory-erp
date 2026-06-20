import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { param } from '../utils/params.js'
import * as targetService from '../services/target.service.js'

export const createTarget = CatchAsyncError(async (req: Request, res: Response) => {
    const target = await targetService.createTarget(param(req.params.id), {
        type: req.body.type,
        value: req.body.value,
        productId: req.body.productId,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate)
    })
    httpResponse(req, res, 201, 'Target created successfully', { target })
})

export const getAllTargets = CatchAsyncError(async (req: Request, res: Response) => {
    const targets = await targetService.listTargets()
    httpResponse(req, res, 200, 'Targets fetched successfully', { count: targets.length, targets })
})

export const getTargetsByUser = CatchAsyncError(async (req: Request, res: Response) => {
    const targets = await targetService.listTargetsByUser(param(req.params.id))
    httpResponse(req, res, 200, 'User targets fetched successfully', { count: targets.length, targets })
})

export const updateTargetProgress = CatchAsyncError(async (req: Request, res: Response) => {
    const target = await targetService.updateTargetProgress(param(req.params.id), req.body.progress)
    httpResponse(req, res, 200, 'Target progress updated successfully', { target })
})

export const deleteTarget = CatchAsyncError(async (req: Request, res: Response) => {
    await targetService.deleteTarget(param(req.params.id))
    httpResponse(req, res, 200, 'Target deleted successfully', null)
})
