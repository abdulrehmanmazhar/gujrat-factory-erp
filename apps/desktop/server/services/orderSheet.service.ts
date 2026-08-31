import ExcelJS from 'exceljs'
import { inArray, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, orderItems, orders, products, units } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { aggregateOrderSheetLines, groupOrderSheetByCategory } from '../utils/orderSheet.js'
import { loadCategoriesForProducts } from './product.service.js'

export { aggregateOrderSheetLines } from '../utils/orderSheet.js'

function orderSheetFilename() {
    return `Order-sheet-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`
}

export async function generateOrderSheetExcel(orderIds: string[]) {
    const uniqueIds = [...new Set(orderIds.map((id) => String(id || '').trim()).filter(Boolean))]
    if (!uniqueIds.length) throw new AppError('orderIds array is required', 400)

    const selected = await db.select().from(orders).where(inArray(orders.id, uniqueIds))
    if (!selected.length) throw new AppError('No matching orders found', 400)

    const productionOrders = selected.filter((order) => order.status === 'saved')
    if (!productionOrders.length) {
        throw new AppError('Select at least one active order. Cancelled and returned orders are skipped.', 400)
    }

    const productionIds = productionOrders.map((order) => order.id)
    const skipped = selected.filter((order) => order.status !== 'saved')

    const itemRows = await db
        .select({
            item: orderItems,
            product: products,
            unit: units
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(units, eq(products.unitId, units.id))
        .where(inArray(orderItems.orderId, productionIds))

    const productIds = [...new Set(itemRows.map((row) => row.product.id))]
    const categoriesByProduct = await loadCategoriesForProducts(productIds)

    const aggregated = aggregateOrderSheetLines(
        itemRows.map(({ item, product, unit }) => {
            const linked = categoriesByProduct.get(product.id) ?? []
            const categoryLabel =
                linked.map((category: { path?: string; name?: string }) => category.path || category.name).filter(Boolean).join(', ') ||
                product.category ||
                'Uncategorized'
            return {
                productId: product.id,
                productName: product.name,
                unitName: unit?.name?.trim() || 'pcs',
                qty: item.qty,
                categoryLabel
            }
        })
    )
    const grouped = groupOrderSheetByCategory(aggregated)

    const customerIds = [...new Set(productionOrders.map((order) => order.customerId))]
    const customerRows = customerIds.length ? await db.select().from(customers).where(inArray(customers.id, customerIds)) : []
    const customerById = new Map(customerRows.map((row) => [row.id, row]))

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Gujrat Factory ERP'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Order sheet')
    sheet.addRow(['Order sheet'])
    sheet.getRow(1).font = { bold: true, size: 14 }
    sheet.addRow(['Generated', new Date().toLocaleString()])
    sheet.addRow([
        'Orders',
        productionOrders
            .map((order) => (order.orderNumber != null ? `#${order.orderNumber}` : order.id.slice(0, 8)))
            .join(', ')
    ])
    sheet.addRow([
        'Skipped (cancelled/returned)',
        skipped.length
            ? skipped.map((order) => (order.orderNumber != null ? `#${order.orderNumber}` : order.id.slice(0, 8))).join(', ')
            : 'None'
    ])
    sheet.addRow([])
    const headerRow = sheet.addRow(['Category', 'Product', 'Unit', 'Quantity'])
    headerRow.font = { bold: true }

    for (const group of grouped) {
        const groupHeader = sheet.addRow([group.category, '', '', group.qty])
        groupHeader.font = { bold: true }
        groupHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8EEF4' }
        }
        for (const line of group.items) {
            sheet.addRow(['', line.product, line.unit, line.qty])
        }
    }

    const totalQty = aggregated.reduce((sum, line) => sum + line.qty, 0)
    sheet.addRow([])
    const totalRow = sheet.addRow(['', '', 'Total', totalQty])
    totalRow.font = { bold: true }

    sheet.columns = [{ width: 36 }, { width: 32 }, { width: 12 }, { width: 12 }]
    sheet.views = [{ state: 'frozen', ySplit: 6 }]

    const categorySheet = workbook.addWorksheet('Category totals')
    categorySheet.addRow(['Category', 'Products', 'Quantity'])
    categorySheet.getRow(1).font = { bold: true }
    for (const group of grouped) {
        categorySheet.addRow([group.category, group.items.length, group.qty])
    }
    const categoryTotal = categorySheet.addRow(['Total', aggregated.length, totalQty])
    categoryTotal.font = { bold: true }
    categorySheet.columns = [{ width: 40 }, { width: 12 }, { width: 12 }]
    categorySheet.views = [{ state: 'frozen', ySplit: 1 }]

    const ordersSheet = workbook.addWorksheet('Included orders')
    ordersSheet.addRow(['Order #', 'Customer', 'Status', 'Date'])
    ordersSheet.getRow(1).font = { bold: true }
    for (const order of productionOrders) {
        ordersSheet.addRow([
            order.orderNumber ?? order.id.slice(0, 8),
            customerById.get(order.customerId)?.name ?? '',
            order.status ?? '',
            order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt
        ])
    }
    ordersSheet.columns = [{ width: 14 }, { width: 28 }, { width: 14 }, { width: 24 }]
    ordersSheet.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return { buffer: Buffer.from(buffer), filename: orderSheetFilename() }
}
