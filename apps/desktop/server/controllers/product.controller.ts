import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { param } from '../utils/params.js'
import * as productService from '../services/product.service.js'
import { getProductRestockHistory } from '../services/restock.service.js'

export const addProduct = CatchAsyncError(async (req: Request, res: Response) => {
    const createdProduct = await productService.addProduct({ ...req.body, createdById: req.user!.id })
    httpResponse(req, res, 200, 'Product added successfully', { createdProduct })
})

export const editProduct = CatchAsyncError(async (req: Request, res: Response) => {
    const editedOne = await productService.editProduct(param(req.params.id), req.body)
    httpResponse(req, res, 200, 'Product updated successfully', { editedOne })
})

export const getProducts = CatchAsyncError(async (req: Request, res: Response) => {
    const products = await productService.listProducts()
    httpResponse(req, res, 200, 'Products fetched successfully', { products })
})

export const deleteProduct = CatchAsyncError(async (req: Request, res: Response) => {
    await productService.deleteProduct(param(req.params.id))
    httpResponse(req, res, 200, 'Deleted the product successfully', null)
})

export const restockProduct = CatchAsyncError(async (req: Request, res: Response) => {
    const editedOne = await productService.restockProduct(param(req.params.id), { ...req.body, createdById: req.user!.id })
    httpResponse(req, res, 200, 'Product restocked successfully', { editedOne })
})

export const getProductStockHistory = CatchAsyncError(async (req: Request, res: Response) => {
    const history = await getProductRestockHistory(param(req.params.id))
    httpResponse(req, res, 200, 'Product stock history fetched successfully', { history })
})
