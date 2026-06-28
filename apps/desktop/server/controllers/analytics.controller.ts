import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import * as analyticsService from '../services/analytics.service.js'
import { buildAnalyticsExcel, excelFilename } from '../services/export.service.js'

export const getHomeAnalytics = CatchAsyncError(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const data = await analyticsService.getHomeSummary(String(startDate), String(endDate))
    httpResponse(req, res, 200, 'Analytics fetched successfully', data)
})

export const exportAnalyticsExcel = CatchAsyncError(async (req: Request, res: Response) => {
    const { report, startDate, endDate } = req.query as { report?: string; startDate?: string; endDate?: string }
    if (!report) throw new AppError('report query param is required', 400)

    const buffer = await buildAnalyticsExcel(report, String(startDate), String(endDate))
    const filename = excelFilename(report, String(startDate), String(endDate))

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
})
