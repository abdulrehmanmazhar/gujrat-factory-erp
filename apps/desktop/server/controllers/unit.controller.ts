import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import * as unitService from '../services/unit.service.js'

export const getUnits = CatchAsyncError(async (req: Request, res: Response) => {
    const units = await unitService.listUnits()
    httpResponse(req, res, 200, 'Units fetched successfully', { units })
})

export const createUnit = CatchAsyncError(async (req: Request, res: Response) => {
    const name = typeof req.body.name === 'string' ? req.body.name : ''
    if (!name.trim()) throw new AppError('Unit name is required', 400)
    const unit = await unitService.createUnit(name)
    httpResponse(req, res, 201, 'Unit created successfully', { unit })
})
