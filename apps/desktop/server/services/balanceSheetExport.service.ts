import ExcelJS from 'exceljs'
import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import {
    customers,
    customerTransactions,
    labourers,
    labourerTransactions,
    suppliers,
    supplierTransactions
} from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { customerTransactionDirection } from '../utils/ledger.js'

type BalanceSheetFilters = { from?: string; to?: string; q?: string }

type BalanceSheetRow = {
    createdAt: Date | string
    description: string
    amount: number
    direction: 'in' | 'out'
}

function parseOptionalBound(value?: string, endOfDay = false) {
    if (!value?.trim()) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) throw new AppError('Invalid date', 400)
    if (endOfDay) date.setHours(23, 59, 59, 999)
    else date.setHours(0, 0, 0, 0)
    return date
}

function inDateRange(value: Date | string | null | undefined, from: Date | null, to: Date | null) {
    if (!from && !to) return true
    if (!value) return false
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return false
    if (from && date < from) return false
    if (to && date > to) return false
    return true
}

function filterTransactions<T extends { createdAt: Date | string }>(
    rows: T[],
    filters: BalanceSheetFilters | undefined,
    mapRow: (row: T) => BalanceSheetRow
) {
    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    if (from && to && from > to) throw new AppError('From date must be before to date', 400)

    return rows.filter((row) => inDateRange(row.createdAt, from, to)).map(mapRow)
}

function supplierTransactionDirection(type: string) {
    return type === 'purchase' || type === 'refund' ? 'in' : 'out'
}

function labourTransactionDirection(category: string) {
    return category === 'production' || category === 'income' ? 'in' : 'out'
}

function formatLocalTimestamp(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value)
    return date.toLocaleString()
}

function formatSignedAmount(amount: number, direction: 'in' | 'out') {
    const formatted = `PKR ${Number(amount || 0).toLocaleString()}`
    return direction === 'in' ? `+ ${formatted}` : `- ${formatted}`
}

function formatNetAmount(amount: number) {
    const prefix = amount >= 0 ? '+' : '-'
    return `${prefix} PKR ${Math.abs(Number(amount || 0)).toLocaleString()}`
}

function safeFilePart(value: string) {
    return value.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'party'
}

export function balanceSheetFilename(partyLabel: string, partyName: string) {
    const datePart = new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
    return `${partyLabel}-balance-sheet-${safeFilePart(partyName)}-${datePart}.xlsx`
}

async function buildBalanceSheetWorkbook(
    sheetTitle: string,
    partyName: string,
    from: Date | null,
    to: Date | null,
    rows: BalanceSheetRow[]
) {
    const sorted = [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Gujrat Factory ERP'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Balance sheet')
    sheet.addRow([sheetTitle])
    sheet.getRow(1).font = { bold: true, size: 14 }
    sheet.addRow(['Party', partyName])
    sheet.addRow(['Generated', new Date().toLocaleString()])
    if (from || to) {
        sheet.addRow([
            'Date range',
            `${from ? from.toLocaleDateString() : '…'} – ${to ? to.toLocaleDateString() : '…'}`
        ])
    }
    sheet.addRow([])

    const headerRow = sheet.addRow(['Timestamp', 'Note', 'In', 'Out', 'Net'])
    headerRow.font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: headerRow.number }]

    let runningNet = 0
    let totalIn = 0
    let totalOut = 0

    for (const row of sorted) {
        if (row.direction === 'in') {
            runningNet += row.amount
            totalIn += row.amount
        } else {
            runningNet -= row.amount
            totalOut += row.amount
        }

        sheet.addRow([
            formatLocalTimestamp(row.createdAt),
            row.description || '—',
            row.direction === 'in' ? formatSignedAmount(row.amount, 'in') : '',
            row.direction === 'out' ? formatSignedAmount(row.amount, 'out') : '',
            formatNetAmount(runningNet)
        ])
    }

    if (!sorted.length) {
        sheet.addRow(['No transactions in selected range', '', '', '', formatNetAmount(0)])
    }

    sheet.addRow([])
    const totalsRow = sheet.addRow([
        'Totals',
        `${sorted.length.toLocaleString()} transaction(s)`,
        formatSignedAmount(totalIn, 'in'),
        formatSignedAmount(totalOut, 'out'),
        formatNetAmount(totalIn - totalOut)
    ])
    totalsRow.font = { bold: true }

    sheet.columns = [{ width: 22 }, { width: 40 }, { width: 18 }, { width: 18 }, { width: 18 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
}

export async function buildCustomerBalanceSheetExcel(customerId: string, filters?: BalanceSheetFilters) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const txnRows = await db
        .select()
        .from(customerTransactions)
        .where(eq(customerTransactions.customerId, customerId))

    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    const mapped = filterTransactions(txnRows, filters, (row) => ({
        createdAt: row.createdAt,
        description: row.description,
        amount: row.amount ?? 0,
        direction: customerTransactionDirection(row.type)
    }))

    return {
        buffer: await buildBalanceSheetWorkbook('Customer balance sheet', customer.name, from, to, mapped),
        filename: balanceSheetFilename('customer', customer.name)
    }
}

export async function buildSupplierBalanceSheetExcel(supplierId: string, filters?: BalanceSheetFilters) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
    if (!supplier) throw new AppError('Supplier not found', 404)

    const txnRows = await db
        .select()
        .from(supplierTransactions)
        .where(eq(supplierTransactions.supplierId, supplierId))

    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    const mapped = filterTransactions(txnRows, filters, (row) => ({
        createdAt: row.createdAt,
        description: row.description,
        amount: row.amount ?? 0,
        direction: supplierTransactionDirection(row.type)
    }))

    return {
        buffer: await buildBalanceSheetWorkbook('Supplier balance sheet', supplier.name, from, to, mapped),
        filename: balanceSheetFilename('supplier', supplier.name)
    }
}

export async function buildLabourBalanceSheetExcel(labourerId: string, filters?: BalanceSheetFilters) {
    const [labourer] = await db.select().from(labourers).where(eq(labourers.id, labourerId)).limit(1)
    if (!labourer) throw new AppError('Labourer not found', 404)

    const txnRows = await db
        .select()
        .from(labourerTransactions)
        .where(eq(labourerTransactions.labourerId, labourerId))

    const from = parseOptionalBound(filters?.from)
    const to = parseOptionalBound(filters?.to, true)
    const mapped = filterTransactions(txnRows, filters, (row) => ({
        createdAt: row.createdAt,
        description: row.description,
        amount: row.amount ?? 0,
        direction: labourTransactionDirection(row.category)
    }))

    return {
        buffer: await buildBalanceSheetWorkbook('Labour balance sheet', labourer.name, from, to, mapped),
        filename: balanceSheetFilename('labour', labourer.name)
    }
}
