import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import * as transactionService from '../services/transaction.service.js'

export const getProductSales = CatchAsyncError(async (req: Request, res: Response) => {
    const { productId, dateRange, startDate, endDate } = req.body
    const sales = await transactionService.getProductSalesByDateRange(productId, dateRange, startDate, endDate)
    httpResponse(req, res, 200, 'Product sales fetched successfully', { sales })
})
