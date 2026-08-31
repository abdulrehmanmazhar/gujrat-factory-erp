import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as orderService from '../services/order.service.js'
import * as invoiceService from '../services/invoice.service.js'
import { resolveDocumentLanguage } from '../services/document.service.js'
import { parsePaymentProofFromBody } from '../utils/paymentMode.js'
import { proofImageUpload, uploadProofImageFromRequest } from '../utils/proofUpload.js'
import { resolveAdditionalCharges, resolveAdditionalDiscounts } from '../utils/labelledAmounts.js'

export const createCart = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await orderService.createCart(param(req.params.id), req.user!.id, req.body.cart)
    httpResponse(req, res, 200, 'Added to cart successfully', { order })
})

export const createOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const additionalDiscounts = resolveAdditionalDiscounts(req.body)
    const additionalCharges = resolveAdditionalCharges(req.body)
    const invoiceBreakdown = req.body.invoiceBreakdown === false || req.body.invoiceBreakdown === 'false' ? false : true
    const result = await orderService.createOrder(
        param(req.params.id),
        req.user!.id,
        req.body.cart,
        req.body.deliveryDate,
        req.body.message,
        additionalDiscounts,
        additionalCharges,
        invoiceBreakdown,
        req.body.orderMode === 'pos' ? 'pos' : 'delayed',
        parseFloat(req.body.payment) || 0
    )
    httpResponse(req, res, 200, result.message, null)
})

export const deleteCart = CatchAsyncError(async (req: Request, res: Response) => {
    await orderService.deleteCartItem(param(req.params.id), parseInt(param(req.params.index), 10))
    httpResponse(req, res, 200, 'Deleted successfully', null)
})

export const addOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const additionalDiscounts = resolveAdditionalDiscounts(req.body)
    const additionalCharges = resolveAdditionalCharges(req.body)
    const invoiceBreakdown = req.body.invoiceBreakdown === false || req.body.invoiceBreakdown === 'false' ? false : true
    const result = await orderService.addOrder(
        param(req.params.id),
        req.body.deliveryDate,
        req.body.message,
        additionalDiscounts,
        additionalCharges,
        invoiceBreakdown
    )
    httpResponse(req, res, 200, result.message, null)
})

export const cancelOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const refundAmount = parseFloat(req.body.refundAmount) || 0
    const order = await orderService.cancelOrder(param(req.params.id), refundAmount, req.user!.id)
    httpResponse(req, res, 200, 'Order cancelled successfully', { order })
})

export const deleteOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const result = await orderService.deleteOrderPermanently(param(req.params.id))
    httpResponse(req, res, 200, result.message, null)
})

export const getOrder = CatchAsyncError(async (req: Request, res: Response) => {
    const order = await orderService.getOrder(param(req.params.id))
    httpResponse(req, res, 200, 'Order fetched successfully', { order })
})

export const getAllOrders = CatchAsyncError(async (req: Request, res: Response) => {
    const orders = await orderService.listOrders()
    httpResponse(req, res, 200, 'Orders fetched successfully', { orders })
})

export const addOrderPayment = [
    proofImageUpload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const payment = parseFloat(String(req.body.payment))
        if (typeof payment !== 'number' || isNaN(payment) || payment < 0) {
            throw new AppError('Order payment must be a valid non-negative number', 400)
        }
        const uploaded = await uploadProofImageFromRequest(req)
        const proof = parsePaymentProofFromBody(req.body, uploaded)
        const order = await orderService.addOrderPayment(param(req.params.id), payment, req.user!.id, proof)
        httpResponse(req, res, 200, 'Payment added successfully', { order })
    })
]

export const returnOrder = [
    proofImageUpload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const refundAmount = parseFloat(String(req.body.refundAmount)) || 0
        const uploaded = await uploadProofImageFromRequest(req)
        const proof = parsePaymentProofFromBody(req.body, uploaded)
        const order = await orderService.returnOrder(param(req.params.id), refundAmount, req.user!.id, proof)
        httpResponse(req, res, 200, 'Order returned successfully', { order })
    })
]

export const recordOrderRefund = [
    proofImageUpload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const refundAmount = parseFloat(String(req.body.refundAmount))
        if (typeof refundAmount !== 'number' || isNaN(refundAmount) || refundAmount <= 0) {
            throw new AppError('refundAmount must be a positive number', 400)
        }
        const uploaded = await uploadProofImageFromRequest(req)
        const proof = parsePaymentProofFromBody(req.body, uploaded)
        const order = await orderService.recordOrderRefund(param(req.params.id), refundAmount, req.user!.id, req.body.notes, proof)
        httpResponse(req, res, 200, 'Refund recorded successfully', { order })
    })
]

export const returnOrderUdhar = CatchAsyncError(async (req: Request, res: Response) => {
    const { payment } = req.body
    if (typeof payment !== 'number' || isNaN(payment) || payment < 0) {
        throw new AppError('Payment must be a valid non-negative number', 400)
    }
    const order = await orderService.returnOrderUdhar(param(req.params.id), payment, req.user!.id)
    httpResponse(req, res, 200, 'Udhar payment applied successfully', { order })
})

export const generateInvoices = CatchAsyncError(async (req: Request, res: Response) => {
    const { orderIds } = req.body as { orderIds?: string[] }
    if (!Array.isArray(orderIds) || !orderIds.length) {
        throw new AppError('orderIds array is required', 400)
    }
    const pdfBuffer = await invoiceService.generateInvoicesPdf(orderIds, resolveDocumentLanguage(req))
    const filename = `Orders-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdfBuffer)
})

export const generateOrderSheet = CatchAsyncError(async (req: Request, res: Response) => {
    const { orderIds } = req.body as { orderIds?: string[] }
    if (!Array.isArray(orderIds) || !orderIds.length) {
        throw new AppError('orderIds array is required', 400)
    }
    const { generateOrderSheetExcel } = await import('../services/orderSheet.service.js')
    const { buffer, filename } = await generateOrderSheetExcel(orderIds)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
})
