import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { param } from '../utils/params.js'
import * as restockService from '../services/restock.service.js'

export const createRestockOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await restockService.createRestockOrder(req.body.supplierId, req.user!.id, req.body.items, req.body.notes, req.body.referenceNumber)
    httpResponse(req, res, 201, 'Restock order created successfully', { order })
})

export const getRestockOrders = CatchAsyncError(async (req: Request, res: Response) => {
    const orders = await restockService.listRestockOrders(req.query.status as string | undefined)
    httpResponse(req, res, 200, 'Restock orders fetched successfully', { orders })
})

export const getRestockOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await restockService.getRestockOrder(param(req.params.id))
    httpResponse(req, res, 200, 'Restock order fetched successfully', { order })
})

export const markRestockOrdered = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await restockService.markRestockOrdered(param(req.params.id))
    httpResponse(req, res, 200, 'Restock order marked as ordered', { order })
})

export const receiveRestockOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await restockService.receiveRestockOrder(param(req.params.id), req.user!.id, req.body.receivedItems)
    httpResponse(req, res, 200, 'Restock order received successfully', { order })
})

export const cancelRestockOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await restockService.cancelRestockOrder(param(req.params.id))
    httpResponse(req, res, 200, 'Restock order cancelled successfully', { order })
})

export const addRestockOrderItem = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await restockService.addRestockOrderItem(param(req.params.id), req.body)
    httpResponse(req, res, 200, 'Restock order item added successfully', { order })
})
