// @ts-nocheck
import ExcelJS from 'exceljs'
import { getAnalyticsDetail } from './analytics.service.js'

function flattenRow(row: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
            if (value instanceof Date) return [key, value.toISOString()]
            if (value && typeof value === 'object') return [key, JSON.stringify(value)]
            return [key, value]
        })
    )
}

export async function buildAnalyticsExcel(report: string, startDate: string, endDate: string) {
    const rows = (await getAnalyticsDetail(report, startDate, endDate)) as Record<string, unknown>[]
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(report)

    if (!rows.length) {
        sheet.addRow(['No data for selected range'])
        const buffer = await workbook.xlsx.writeBuffer()
        return Buffer.from(buffer)
    }

    const flat = rows.map(flattenRow)
    const headers = Object.keys(flat[0])
    sheet.addRow(headers)
    for (const row of flat) {
        sheet.addRow(headers.map((h) => row[h] ?? ''))
    }

    sheet.getRow(1).font = { bold: true }
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
}

export function excelFilename(report: string, startDate: string, endDate: string) {
    const safe = report.replace(/[^a-z0-9-]/gi, '-')
    return `${safe}-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}.xlsx`
}
