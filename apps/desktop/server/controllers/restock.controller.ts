import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { param } from '../utils/params.js'
import { AppError } from '../utils/errors.js'
import * as restockService from '../services/restock.service.js'
import { listSupplierTransactions, deleteSupplierTransaction as removeSupplierTransaction } from '../services/supplierTransaction.service.js'
import { parsePaymentProofFromBody } from '../utils/paymentMode.js'
import { proofImageUpload, uploadProofImageFromRequest } from '../utils/proofUpload.js'

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

export const deleteRestockOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const result = await restockService.deleteRestockOrderPermanently(param(req.params.id))
    httpResponse(req, res, 200, result.message, null)
})

export const addRestockOrderItem = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await restockService.addRestockOrderItem(param(req.params.id), req.body)
    httpResponse(req, res, 200, 'Restock order item added successfully', { order })
})

export const getSupplierTransactions = CatchAsyncError(async (req: Request, res: Response) => {
    const restockOrderId = typeof req.query.restockOrderId === 'string' ? req.query.restockOrderId : undefined
    const transactions = await listSupplierTransactions(restockOrderId)
    httpResponse(req, res, 200, 'Supplier transactions fetched successfully', { transactions })
})

export const deleteSupplierTransaction = CatchAsyncError(async (req: Request, res: Response) => {
    await removeSupplierTransaction(param(req.params.id))
    httpResponse(req, res, 200, 'Supplier transaction deleted successfully', null)
})

export const recordRestockPayment = [
    proofImageUpload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const amount = parseFloat(String(req.body.amount))
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
            throw new AppError('amount must be a positive number', 400)
        }
        const uploaded = await uploadProofImageFromRequest(req)
        const proof = parsePaymentProofFromBody(req.body, uploaded)
        const order = await restockService.recordRestockPayment(param(req.params.id), amount, req.user!.id, req.body.notes, proof)
        httpResponse(req, res, 200, 'Restock payment recorded successfully', { order })
    })
]

export const recordRestockRefund = [
    proofImageUpload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        let returnedItems = req.body.returnedItems as { itemId: string; qtyReturned: number }[] | string | undefined
        if (typeof returnedItems === 'string') {
            try {
                returnedItems = JSON.parse(returnedItems) as { itemId: string; qtyReturned: number }[]
            } catch {
                throw new AppError('returnedItems must be valid JSON', 400)
            }
        }
        if (!Array.isArray(returnedItems) || !returnedItems.length) {
            throw new AppError('returnedItems array is required', 400)
        }
        const requestedCashRefund =
            req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '' ? parseFloat(String(req.body.amount)) : undefined
        if (requestedCashRefund !== undefined && (typeof requestedCashRefund !== 'number' || Number.isNaN(requestedCashRefund))) {
            throw new AppError('amount must be a valid number when provided', 400)
        }
        const uploaded = await uploadProofImageFromRequest(req)
        const proof = parsePaymentProofFromBody(req.body, uploaded)
        const order = await restockService.recordRestockRefund(
            param(req.params.id),
            req.user!.id,
            req.body.notes,
            returnedItems,
            requestedCashRefund,
            proof
        )
        httpResponse(req, res, 200, 'Restock refund recorded successfully', { order })
    })
]
