import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { param } from '../utils/params.js'
import * as supplierService from '../services/supplier.service.js'

export const createSupplier = CatchAsyncError(async (req: Request, res: Response) => {
    const supplier = await supplierService.createSupplier(req.body)
    httpResponse(req, res, 201, 'Supplier created successfully', { supplier })
})

export const updateSupplier = CatchAsyncError(async (req: Request, res: Response) => {
    const supplier = await supplierService.updateSupplier(param(req.params.id), req.body)
    httpResponse(req, res, 200, 'Supplier updated successfully', { supplier })
})

export const getSuppliers = CatchAsyncError(async (req: Request, res: Response) => {
    const suppliers = await supplierService.listSuppliers(req.query.includeInactive === 'true')
    httpResponse(req, res, 200, 'Suppliers fetched successfully', { suppliers })
})

export const getSupplier = CatchAsyncError(async (req: Request, res: Response) => {
    const supplier = await supplierService.getSupplierById(param(req.params.id))
    httpResponse(req, res, 200, 'Supplier fetched successfully', { supplier })
})

export const deactivateSupplier = CatchAsyncError(async (req: Request, res: Response) => {
    const supplier = await supplierService.deactivateSupplier(param(req.params.id))
    httpResponse(req, res, 200, 'Supplier deactivated successfully', { supplier })
})

export const linkSupplierProduct = CatchAsyncError(async (req: Request, res: Response) => {
    await supplierService.linkSupplierProduct(param(req.params.id), req.body.productId, req.body)
    httpResponse(req, res, 200, 'Supplier product linked successfully', null)
})

export const unlinkSupplierProduct = CatchAsyncError(async (req: Request, res: Response) => {
    await supplierService.unlinkSupplierProduct(param(req.params.id), param(req.params.productId))
    httpResponse(req, res, 200, 'Supplier product unlinked successfully', null)
})
