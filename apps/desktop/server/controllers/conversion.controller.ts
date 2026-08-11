import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as conversionService from '../services/conversion.service.js'

export const getConversions = CatchAsyncError(async (req: Request, res: Response) => {
    const conversions = await conversionService.listConversions()
    httpResponse(req, res, 200, 'Conversions fetched successfully', { conversions })
})

export const getConversion = CatchAsyncError(async (req: Request, res: Response) => {
    const conversion = await conversionService.getConversionById(param(req.params.id))
    httpResponse(req, res, 200, 'Conversion fetched successfully', { conversion })
})

export const createConversion = CatchAsyncError(async (req: Request, res: Response) => {
    const { inputProductId, outputProductId, inputRatio, outputRatio, inputQty, outputQty, notes } = req.body
    if (!inputProductId || !outputProductId || inputRatio == null || outputRatio == null) {
        throw new AppError('inputProductId, outputProductId, inputRatio and outputRatio are required', 400)
    }

    const conversion = await conversionService.createConversion({
        inputProductId,
        outputProductId,
        inputRatio: Number(inputRatio),
        outputRatio: Number(outputRatio),
        inputQty: inputQty === undefined || inputQty === '' ? undefined : Number(inputQty),
        outputQty: outputQty === undefined || outputQty === '' ? undefined : Number(outputQty),
        notes,
        createdById: req.user!.id
    })
    httpResponse(req, res, 201, 'Conversion recorded successfully', { conversion })
})

export const undoConversion = CatchAsyncError(async (req: Request, res: Response) => {
    await conversionService.undoConversion(param(req.params.id))
    httpResponse(req, res, 200, 'Conversion undone successfully', null)
})
