import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
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
    const suppliers = await supplierService.listSuppliers()
    httpResponse(req, res, 200, 'Suppliers fetched successfully', { suppliers })
})

export const getSupplier = CatchAsyncError(async (req: Request, res: Response) => {
    const supplier = await supplierService.getSupplierById(param(req.params.id))
    httpResponse(req, res, 200, 'Supplier fetched successfully', { supplier })
})

export const deleteSupplier = CatchAsyncError(async (req: Request, res: Response) => {
    await supplierService.deleteSupplier(param(req.params.id))
    httpResponse(req, res, 200, 'Supplier and all linked records deleted successfully', null)
})

export const linkSupplierProduct = CatchAsyncError(async (req: Request, res: Response) => {
    await supplierService.linkSupplierProduct(param(req.params.id), req.body.productId, req.body)
    httpResponse(req, res, 200, 'Supplier product linked successfully', null)
})

export const linkSupplierProductsByCategories = CatchAsyncError(async (req: Request, res: Response) => {
    const categoryIds = Array.isArray(req.body.categoryIds) ? req.body.categoryIds : []
    if (!categoryIds.length) throw new AppError('Select at least one category', 400)
    const result = await supplierService.linkSupplierProductsByCategories(param(req.params.id), categoryIds, req.body)
    httpResponse(req, res, 200, `Linked ${result.linked} product(s) from selected categories`, result)
})

export const unlinkSupplierProduct = CatchAsyncError(async (req: Request, res: Response) => {
    await supplierService.unlinkSupplierProduct(param(req.params.id), param(req.params.productId))
    httpResponse(req, res, 200, 'Supplier product unlinked successfully', null)
})
