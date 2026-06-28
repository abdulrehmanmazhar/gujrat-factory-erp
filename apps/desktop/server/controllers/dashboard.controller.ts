import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as orderService from '../services/order.service.js'

export const getUpcomingDeliveries = CatchAsyncError(async (req: Request, res: Response) => {
    const days = parseInt(String(req.query.days ?? '14'), 10) || 14
    const orders = await orderService.listUpcomingDeliveries(days)
    httpResponse(req, res, 200, 'Upcoming deliveries fetched successfully', { orders })
})

export const getStockVsPending = CatchAsyncError(async (req: Request, res: Response) => {
    const products = await orderService.getStockVsPendingDelayed()
    httpResponse(req, res, 200, 'Stock vs pending demand fetched successfully', { products })
})

export const postponeDelivery = CatchAsyncError(async (req: Request, res: Response) => {
    const { deliveryDate } = req.body as { deliveryDate?: string }
    if (!deliveryDate) throw new AppError('deliveryDate is required', 400)
    const order = await orderService.postponeOrderDelivery(param(req.params.id), deliveryDate)
    httpResponse(req, res, 200, 'Delivery date updated successfully', { order })
})
