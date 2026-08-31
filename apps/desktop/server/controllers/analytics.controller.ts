import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import * as analyticsService from '../services/analytics.service.js'
import {
    buildCustomerBalanceSheetExcel,
    buildLabourBalanceSheetExcel,
    buildSupplierBalanceSheetExcel
} from '../services/balanceSheetExport.service.js'
import { buildAnalyticsExcel, buildBusinessDataExcel, businessDataExcelFilename, excelFilename } from '../services/export.service.js'

function sendExcel(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
}

export const getHomeAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const data = await analyticsService.getHomeSummary(String(startDate), String(endDate))
    httpResponse(req, res, 200, 'Analytics fetched successfully', data)
})

export const getCustomerAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to, q } = req.query as { from?: string; to?: string; q?: string }
    const customers = await analyticsService.getCustomerAnalytics({ from, to, q })
    httpResponse(req, res, 200, 'Customer analytics fetched successfully', { customers })
})

export const getCustomerAnalyticsDetail = CatchAsyncError(async (req: Request, res: Response) => {
    const data = await analyticsService.getCustomerAnalyticsDetail(String(req.params.id))
    httpResponse(req, res, 200, 'Customer analytics detail fetched successfully', data)
})

export const getSupplierAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to, q } = req.query as { from?: string; to?: string; q?: string }
    const suppliers = await analyticsService.getSupplierAnalytics({ from, to, q })
    httpResponse(req, res, 200, 'Supplier analytics fetched successfully', { suppliers })
})

export const getSupplierAnalyticsDetail = CatchAsyncError(async (req: Request, res: Response) => {
    const data = await analyticsService.getSupplierAnalyticsDetail(String(req.params.id))
    httpResponse(req, res, 200, 'Supplier analytics detail fetched successfully', data)
})

export const getLabourAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to, q } = req.query as { from?: string; to?: string; q?: string }
    const labourers = await analyticsService.getLabourAnalytics({ from, to, q })
    httpResponse(req, res, 200, 'Labour analytics fetched successfully', { labourers })
})

export const getLabourAnalyticsDetail = CatchAsyncError(async (req: Request, res: Response) => {
    const data = await analyticsService.getLabourAnalyticsDetail(String(req.params.id))
    httpResponse(req, res, 200, 'Labour analytics detail fetched successfully', data)
})

export const getInventoryCustomerAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const customers = await analyticsService.getInventoryCustomerAnalytics({ from, to })
    httpResponse(req, res, 200, 'Inventory customer analytics fetched successfully', { customers })
})

export const getInventorySupplierAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const suppliers = await analyticsService.getInventorySupplierAnalytics({ from, to })
    httpResponse(req, res, 200, 'Inventory supplier analytics fetched successfully', { suppliers })
})

export const getInventoryLabourAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const labourers = await analyticsService.getInventoryLabourAnalytics({ from, to })
    httpResponse(req, res, 200, 'Inventory labour analytics fetched successfully', { labourers })
})

export const exportCustomerBalanceSheet = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to, q } = req.query as { from?: string; to?: string; q?: string }
    const { buffer, filename } = await buildCustomerBalanceSheetExcel(String(req.params.id), { from, to, q })
    sendExcel(res, buffer, filename)
})

export const exportSupplierBalanceSheet = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to, q } = req.query as { from?: string; to?: string; q?: string }
    const { buffer, filename } = await buildSupplierBalanceSheetExcel(String(req.params.id), { from, to, q })
    sendExcel(res, buffer, filename)
})

export const exportLabourBalanceSheet = CatchAsyncError(async (req: Request, res: Response) => {
    const { from, to, q } = req.query as { from?: string; to?: string; q?: string }
    const { buffer, filename } = await buildLabourBalanceSheetExcel(String(req.params.id), { from, to, q })
    sendExcel(res, buffer, filename)
})

export const exportAnalyticsExcel = CatchAsyncError(async (req: Request, res: Response) => {
    const { report, startDate, endDate } = req.query as { report?: string; startDate?: string; endDate?: string }
    if (!report) throw new AppError('report query param is required', 400)

    const buffer = await buildAnalyticsExcel(report, String(startDate), String(endDate))
    const filename = excelFilename(report, String(startDate), String(endDate))

    sendExcel(res, buffer, filename)
})

export const exportBusinessDataExcel = CatchAsyncError(async (req: Request, res: Response) => {
    const buffer = await buildBusinessDataExcel()
    const filename = businessDataExcelFilename()
    sendExcel(res, buffer, filename)
})
