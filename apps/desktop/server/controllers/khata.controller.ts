import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { param } from '../utils/params.js'
import { AppError } from '../utils/errors.js'
import * as khataService from '../services/khata.service.js'
import { parsePaymentProofFromBody } from '../utils/paymentMode.js'
import { proofImageUpload, uploadProofImageFromRequest } from '../utils/proofUpload.js'

function parseAmount(value: unknown) {
    const amount = parseFloat(String(value))
    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
        throw new AppError('amount must be a positive number', 400)
    }
    return amount
}

function parseDirection(value: unknown): 'in' | 'out' {
    const direction = String(value ?? '')
    if (direction !== 'in' && direction !== 'out') {
        throw new AppError('direction must be in or out', 400)
    }
    return direction
}

export const getCustomerKhata = CatchAsyncError(async (req: Request, res: Response) => {
    const entries = await khataService.listCustomerKhata({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined
    })
    httpResponse(req, res, 200, 'Customer khata fetched', { entries })
})

export const getSupplierKhata = CatchAsyncError(async (req: Request, res: Response) => {
    const entries = await khataService.listSupplierKhata({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined
    })
    httpResponse(req, res, 200, 'Supplier khata fetched', { entries })
})

export const createCustomerKhata = [
    proofImageUpload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const amount = parseAmount(req.body.amount)
        const direction = parseDirection(req.body.direction)
        const customerId = String(req.body.customerId ?? '')
        if (!customerId) throw new AppError('customerId is required', 400)

        const uploaded = await uploadProofImageFromRequest(req)
        const proof = parsePaymentProofFromBody(req.body, uploaded)
        const entry = await khataService.createCustomerKhataEntry({
            customerId,
            direction,
            amount,
            description: typeof req.body.description === 'string' ? req.body.description : undefined,
            createdById: req.user!.id,
            proof
        })
        httpResponse(req, res, 201, 'Customer khata entry recorded', { entry })
    })
]

export const createSupplierKhata = [
    proofImageUpload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const amount = parseAmount(req.body.amount)
        const direction = parseDirection(req.body.direction)
        const supplierId = String(req.body.supplierId ?? '')
        if (!supplierId) throw new AppError('supplierId is required', 400)

        const uploaded = await uploadProofImageFromRequest(req)
        const proof = parsePaymentProofFromBody(req.body, uploaded)
        const entry = await khataService.createSupplierKhataEntry({
            supplierId,
            direction,
            amount,
            description: typeof req.body.description === 'string' ? req.body.description : undefined,
            createdById: req.user!.id,
            proof
        })
        httpResponse(req, res, 201, 'Supplier khata entry recorded', { entry })
    })
]

export const deleteKhata = CatchAsyncError(async (req: Request, res: Response) => {
    const party = param(req.params.party)
    if (party !== 'customer' && party !== 'supplier') {
        throw new AppError('party must be customer or supplier', 400)
    }
    await khataService.deleteKhataEntry(party, param(req.params.id))
    httpResponse(req, res, 200, 'Khata entry deleted', null)
})
