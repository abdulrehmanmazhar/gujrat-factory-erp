// @ts-nocheck
import ExcelJS from 'exceljs'
import { db } from '../utils/db.js'
import {
    categories,
    customers,
    customerTransactions,
    inventoryBatchAllocations,
    inventoryBatches,
    labourers,
    labourerTransactions,
    labourProductionConsumption,
    labourProductionEntries,
    labourRates,
    miscExpenditureCategories,
    miscellaneousExpenditures,
    orderItems,
    orders,
    productCategories,
    productConversions,
    products,
    productSales,
    productStockHistory,
    recipeItems,
    recipes,
    restockOrderItems,
    restockOrders,
    supplierProducts,
    suppliers,
    supplierTransactions,
    units
} from '../models/tables.js'
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

function addSheet(workbook: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
    const sheet = workbook.addWorksheet(name.slice(0, 31))
    if (!rows.length) {
        sheet.addRow(['No data'])
        sheet.getRow(1).font = { bold: true }
        return sheet
    }

    const flat = rows.map(flattenRow)
    const headers = Object.keys(flat[0])
    sheet.addRow(headers)
    for (const row of flat) {
        sheet.addRow(headers.map((h) => row[h] ?? ''))
    }
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length }
    }
    return sheet
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

/** Full operational business export. Excludes AI, WhatsApp, auth/passwords, and device storage. */
export async function buildBusinessDataExcel() {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Gujrat Factory ERP'
    workbook.created = new Date()
    workbook.description = 'Operational business data export (excludes AI chats/keys, WhatsApp, and auth secrets)'

    const [
        unitRows,
        categoryRows,
        customerRows,
        productRows,
        productCategoryRows,
        supplierRows,
        supplierProductRows,
        restockOrderRows,
        restockItemRows,
        stockHistoryRows,
        orderRows,
        orderItemRows,
        customerTxnRows,
        supplierTxnRows,
        labourerRows,
        labourTxnRows,
        labourRateRows,
        productionRows,
        consumptionRows,
        productSaleRows,
        batchRows,
        allocationRows,
        recipeRows,
        recipeItemRows,
        conversionRows,
        miscCategoryRows,
        miscRows
    ] = await Promise.all([
        db.select().from(units),
        db.select().from(categories),
        db.select().from(customers),
        db.select().from(products),
        db.select().from(productCategories),
        db.select().from(suppliers),
        db.select().from(supplierProducts),
        db.select().from(restockOrders),
        db.select().from(restockOrderItems),
        db.select().from(productStockHistory),
        db.select().from(orders),
        db.select().from(orderItems),
        db.select().from(customerTransactions),
        db.select().from(supplierTransactions),
        db.select().from(labourers),
        db.select().from(labourerTransactions),
        db.select().from(labourRates),
        db.select().from(labourProductionEntries),
        db.select().from(labourProductionConsumption),
        db.select().from(productSales),
        db.select().from(inventoryBatches),
        db.select().from(inventoryBatchAllocations),
        db.select().from(recipes),
        db.select().from(recipeItems),
        db.select().from(productConversions),
        db.select().from(miscExpenditureCategories),
        db.select().from(miscellaneousExpenditures)
    ])

    const productName = new Map(productRows.map((row) => [row.id, row.name]))
    const customerName = new Map(customerRows.map((row) => [row.id, row.name]))
    const supplierName = new Map(supplierRows.map((row) => [row.id, row.name]))
    const labourerName = new Map(labourerRows.map((row) => [row.id, row.name]))
    const unitName = new Map(unitRows.map((row) => [row.id, row.name]))
    const categoryName = new Map(categoryRows.map((row) => [row.id, row.name]))

    addSheet(workbook, 'Units', unitRows)
    addSheet(
        workbook,
        'Categories',
        categoryRows.map((row) => ({
            ...row,
            parentName: row.parentId ? categoryName.get(row.parentId) ?? null : null
        }))
    )
    addSheet(workbook, 'Customers', customerRows)
    addSheet(
        workbook,
        'Products',
        productRows.map((row) => ({
            ...row,
            unitName: unitName.get(row.unitId) ?? null
        }))
    )
    addSheet(
        workbook,
        'ProductCategories',
        productCategoryRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null,
            categoryName: categoryName.get(row.categoryId) ?? null
        }))
    )
    addSheet(workbook, 'Suppliers', supplierRows)
    addSheet(
        workbook,
        'SupplierProducts',
        supplierProductRows.map((row) => ({
            ...row,
            supplierName: supplierName.get(row.supplierId) ?? null,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'RestockOrders',
        restockOrderRows.map((row) => ({
            ...row,
            supplierName: supplierName.get(row.supplierId) ?? null
        }))
    )
    addSheet(
        workbook,
        'RestockOrderItems',
        restockItemRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'ProductStockHistory',
        stockHistoryRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'Orders',
        orderRows.map((row) => ({
            ...row,
            customerName: customerName.get(row.customerId) ?? null
        }))
    )
    addSheet(
        workbook,
        'OrderItems',
        orderItemRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'CustomerTransactions',
        customerTxnRows.map((row) => ({
            ...row,
            customerName: customerName.get(row.customerId) ?? null
        }))
    )
    addSheet(
        workbook,
        'SupplierTransactions',
        supplierTxnRows.map((row) => ({
            ...row,
            supplierName: supplierName.get(row.supplierId) ?? null
        }))
    )
    addSheet(workbook, 'Labourers', labourerRows)
    addSheet(
        workbook,
        'LabourerTransactions',
        labourTxnRows.map((row) => ({
            ...row,
            labourerName: labourerName.get(row.labourerId) ?? null
        }))
    )
    addSheet(
        workbook,
        'LabourRates',
        labourRateRows.map((row) => ({
            ...row,
            labourerName: labourerName.get(row.labourerId) ?? null,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'LabourProduction',
        productionRows.map((row) => ({
            ...row,
            labourerName: labourerName.get(row.labourerId) ?? null,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'LabourConsumption',
        consumptionRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'ProductSales',
        productSaleRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null,
            customerName: customerName.get(row.customerId) ?? null
        }))
    )
    addSheet(
        workbook,
        'InventoryBatches',
        batchRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null,
            supplierName: row.supplierId ? supplierName.get(row.supplierId) ?? null : null,
            labourerName: row.labourerId ? labourerName.get(row.labourerId) ?? null : null
        }))
    )
    addSheet(
        workbook,
        'BatchAllocations',
        allocationRows.map((row) => ({
            ...row,
            productName: productName.get(row.productId) ?? null
        }))
    )
    addSheet(
        workbook,
        'Recipes',
        recipeRows.map((row) => ({
            ...row,
            outputProductName: productName.get(row.outputProductId) ?? null
        }))
    )
    addSheet(
        workbook,
        'RecipeItems',
        recipeItemRows.map((row) => ({
            ...row,
            ingredientProductName: productName.get(row.ingredientProductId) ?? null
        }))
    )
    addSheet(
        workbook,
        'ProductConversions',
        conversionRows.map((row) => ({
            ...row,
            inputProductName: productName.get(row.inputProductId) ?? null,
            outputProductName: productName.get(row.outputProductId) ?? null
        }))
    )
    addSheet(workbook, 'MiscCategories', miscCategoryRows)
    addSheet(workbook, 'MiscExpenditures', miscRows)

    const meta = workbook.addWorksheet('_ExportInfo')
    meta.addRow(['ExportedAt', new Date().toISOString()])
    meta.addRow(['Scope', 'Operational business tables only'])
    meta.addRow(['Excluded', 'users/passwords, Gemini keys, AI chat sessions/messages, WhatsApp queue/auth, device storage'])
    meta.getColumn(1).font = { bold: true }

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
}

export function businessDataExcelFilename() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `gujrat-factory-business-data-${stamp}.xlsx`
}
