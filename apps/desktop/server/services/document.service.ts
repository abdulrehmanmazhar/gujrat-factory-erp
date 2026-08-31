// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import { generatePDF } from 'pdf-node'
import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, customerTransactions, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { moduleDir } from '../utils/esm.js'
import * as orderService from './order.service.js'
import {
    type DocumentLanguage,
    documentDir,
    formatDocPage,
    getDocumentLabels,
    invoiceTitle,
    receiptTitle as localizedReceiptTitle
} from '../utils/documentI18n.js'
import { getDocumentLanguage, readAppSettings } from '../utils/appSettings.js'
import { computeCustomerOwed } from '../utils/ledger.js'
import type { Request } from 'express'

/** Max item rows on the first page (full header + optional receipt banner + footer). */
export const ITEMS_FIRST_PAGE = 18
/** Max item rows on continuation pages (compact header). */
export const ITEMS_CONTINUATION_PAGE = 24
/** @deprecated use ITEMS_FIRST_PAGE — kept for callers that referenced the old constant */
export const ITEMS_PER_SLIP = ITEMS_FIRST_PAGE
const PDF_MARGIN_MM = 10
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
/** Printable A4 area after standard 10mm page margins */
export const SLIP_WIDTH_MM = A4_WIDTH_MM - PDF_MARGIN_MM * 2
export const SLIP_HEIGHT_MM = A4_HEIGHT_MM - PDF_MARGIN_MM * 2

const templatesDir = path.join(moduleDir(import.meta.url), '../templates')
const publicDir = path.join(moduleDir(import.meta.url), '../public')

export const company = {
    address: process.env.COMPANY_ADDRESS || 'Hafizabad Road Vanike Tarar',
    phone: process.env.COMPANY_PHONE || '+92 340 4646799'
}

export function formatDate(value?: Date | string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-GB')
}

export function formatDateTime(value?: Date | string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-GB')
}

export function formatMoney(value?: number | null) {
    return Number(value ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

export function getLogoDataUrl() {
    const logoPath = path.join(publicDir, 'logo.png')
    if (!fs.existsSync(logoPath)) return null
    const buffer = fs.readFileSync(logoPath)
    return `data:image/png;base64,${buffer.toString('base64')}`
}

function embedFontFace(family: string, filePath: string, weight: number) {
    if (!fs.existsSync(filePath)) return ''
    const base64 = fs.readFileSync(filePath).toString('base64')
    return `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${base64}) format('truetype');font-weight:${weight};font-style:normal;}`
}

/** Embed Windows Arial so Puppeteer renders the same font users see in Word/Excel. */
export function getDocumentFontCss(lang: DocumentLanguage) {
    if (lang === 'ur') return ''

    const fontsDir = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
    const regular = path.join(fontsDir, 'arial.ttf')
    const bold = path.join(fontsDir, 'arialbd.ttf')

    return [embedFontFace('DocArial', regular, 400), embedFontFace('DocArial', bold, 700)].filter(Boolean).join('')
}

export function getDocumentFontFamily(lang: DocumentLanguage) {
    if (lang === 'ur') return "'Noto Sans Arabic', Arial, sans-serif"
    return "'DocArial', Arial, sans-serif"
}

export async function buildInvoiceOrder(orderId: string) {
    const order = await orderService.getOrder(orderId)
    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    const [booker] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, order.createdById ?? order.createdBy))
        .limit(1)

    const previousTxns = customer
        ? await db
              .select({ type: customerTransactions.type, amount: customerTransactions.amount, orderId: customerTransactions.orderId })
              .from(customerTransactions)
              .where(eq(customerTransactions.customerId, order.customerId))
        : []
    const previousDues = computeCustomerOwed(previousTxns.filter((txn) => txn.orderId !== orderId))

    return {
        ...order,
        customer: customer
            ? {
                  name: customer.name,
                  contact: customer.contact,
                  address: customer.address,
                  udhar: previousDues
              }
            : {
                  name: order.customerDetails?.name ?? 'Unknown',
                  contact: order.customerDetails?.contact ?? '—',
                  address: '—',
                  udhar: 0
              },
        orderBooker: booker?.name ?? order.userDetails?.name ?? 'Unknown',
        cart: order.cart ?? []
    }
}

function mapCartLines(cart: Array<Record<string, unknown>>) {
    return (cart ?? []).map((item) => {
        const unitPrice = item.unitPrice ?? item.product?.price ?? 0
        const unitDiscount = item.unitDiscount ?? item.product?.discount ?? 0
        const qty = item.qty ?? 0
        const unitName = item.product?.unit?.name || item.product?.unitName || 'pcs'
        return {
            description: `${item.product?.name ?? 'Product'}${item.product?.category ? ` (${item.product.category})` : ''}`,
            qty,
            unitName,
            unitPrice,
            discount: unitDiscount,
            total: unitPrice * qty - unitDiscount * qty
        }
    })
}

function firstPageCapacity(hasReceipt: boolean) {
    return hasReceipt ? 14 : ITEMS_FIRST_PAGE
}

function countOrderPages(lineCount: number, hasReceipt: boolean) {
    if (lineCount <= 0) return 1
    const first = firstPageCapacity(hasReceipt)
    if (lineCount <= first) return 1
    return 1 + Math.ceil((lineCount - first) / ITEMS_CONTINUATION_PAGE)
}

function chunkLines<T>(lines: T[], hasReceipt: boolean) {
    if (!lines.length) return [{ lines: [] as T[], capacity: firstPageCapacity(hasReceipt), isContinuation: false }]

    const chunks: Array<{ lines: T[]; capacity: number; isContinuation: boolean }> = []
    let offset = 0
    let pageIndex = 0

    while (offset < lines.length) {
        const capacity = pageIndex === 0 ? firstPageCapacity(hasReceipt) : ITEMS_CONTINUATION_PAGE
        chunks.push({
            lines: lines.slice(offset, offset + capacity),
            capacity,
            isContinuation: pageIndex > 0
        })
        offset += capacity
        pageIndex += 1
    }

    return chunks
}

function padLines(lines: Array<Record<string, unknown> | null>, capacity: number) {
    const padded = [...lines]
    while (padded.length < capacity) padded.push(null)
    return padded
}

export function buildSlipsFromOrder(
    order: Awaited<ReturnType<typeof buildInvoiceOrder>>,
    options: {
        documentTitle?: string
        lang?: DocumentLanguage
        receipt?: { type: string; amount: number; date: string; description: string } | null
    } = {}
) {
    const lang = options.lang ?? readAppSettings().documentLanguage
    const storedPrice = order.price ?? 0
    const storedDiscount = order.discount ?? 0
    const storedCharges = order.charges ?? 0
    const additionalCharges = Array.isArray(order.additionalCharges) ? order.additionalCharges : []
    const additionalDiscounts = Array.isArray(order.additionalDiscounts) ? order.additionalDiscounts : []
    const invoiceBreakdown = order.invoiceBreakdown !== false
    const allLines = mapCartLines(order.cart ?? [])
    const itemsSubtotal = allLines.reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.qty), 0)
    const lineDiscountTotal = allLines.reduce((sum, line) => sum + Number(line.discount) * Number(line.qty), 0)
    // New orders store net in price (charges/discount columns are 0). Legacy rows still use price + charges - discount.
    const grandTotal = Math.max(storedPrice + storedCharges - storedDiscount, 0)
    const paid = order.payment ?? 0
    const hasReceipt = Boolean(options.receipt)
    const lineChunks = chunkLines(allLines, hasReceipt)
    const partTotal = countOrderPages(allLines.length, hasReceipt)
    let lineNumberOffset = 0

    return lineChunks.map((chunk, index) => {
        const lines = chunk.lines
        const slip = {
            documentTitle: options.documentTitle ?? invoiceTitle(lang),
            orderNumber: order.orderNumber,
            customer: {
                name: order.customer.name,
                contact: order.customer.contact,
                address: order.customer.address,
                udhar: order.customer.udhar ?? 0
            },
            bookingDate: formatDateTime(order.createdAt),
            deliveryDate: formatDate(order.deliveryDate),
            orderBooker: order.orderBooker,
            message: order.message ?? '',
            price: itemsSubtotal,
            discount: lineDiscountTotal + additionalDiscounts.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
            charges: additionalCharges.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
            lineDiscountTotal,
            additionalCharges,
            additionalDiscounts,
            invoiceBreakdown,
            grandTotal,
            paid,
            outstanding: Math.max(grandTotal - paid, 0),
            lines,
            paddedLines: padLines(lines, chunk.capacity),
            partIndex: index + 1,
            partTotal,
            showTotals: index === lineChunks.length - 1,
            isContinuation: chunk.isContinuation,
            lineNumberOffset,
            rowCapacity: chunk.capacity,
            itemRowHeightPercent: 100 / chunk.capacity,
            allLinesCount: allLines.length,
            receipt: chunk.isContinuation ? null : (options.receipt ?? null)
        }
        lineNumberOffset += lines.length
        return slip
    })
}

/** One slip (or continuation page) per physical PDF page. */
export function packSlipsIntoPages(slips: ReturnType<typeof buildSlipsFromOrder>) {
    return slips.map((slip) => ({ slips: [slip] }))
}

export async function buildSlipsForOrders(orderIds: string[], documentTitle?: string, lang?: DocumentLanguage) {
    const documentLanguage = lang ?? readAppSettings().documentLanguage
    const title = documentTitle ?? invoiceTitle(documentLanguage)
    const uniqueIds = [...new Set(orderIds)]
    const builtOrders = await Promise.all(uniqueIds.map((id) => buildInvoiceOrder(id)))
    return builtOrders.flatMap((order) => buildSlipsFromOrder(order, { documentTitle: title, lang: documentLanguage }))
}

export async function renderOrderDocumentPdf(
    pages: ReturnType<typeof packSlipsIntoPages>,
    templateName = 'order-document.ejs',
    lang?: DocumentLanguage
) {
    const documentLanguage = lang ?? readAppSettings().documentLanguage
    const labels = getDocumentLabels(documentLanguage)
    const dir = documentDir(documentLanguage)
    const html = fs.readFileSync(path.join(templatesDir, templateName), 'utf8')

    const result = await generatePDF({
        html,
        data: {
            pages,
            company,
            logoDataUrl: getLogoDataUrl(),
            lang: documentLanguage,
            dir,
            labels,
            fontCss: getDocumentFontCss(documentLanguage),
            fontFamily: getDocumentFontFamily(documentLanguage),
            pageWidthMm: `${SLIP_WIDTH_MM}mm`,
            pageHeightMm: `${SLIP_HEIGHT_MM}mm`,
            formatPage: (current: number, total: number) => formatDocPage(documentLanguage, current, total)
        },
        engine: 'ejs',
        type: 'pdf',
        buffer: true,
        pdfOptions: {
            format: 'A4',
            width: `${A4_WIDTH_MM}mm`,
            height: `${A4_HEIGHT_MM}mm`,
            orientation: 'portrait',
            border: {
                top: `${PDF_MARGIN_MM}mm`,
                right: `${PDF_MARGIN_MM}mm`,
                bottom: `${PDF_MARGIN_MM}mm`,
                left: `${PDF_MARGIN_MM}mm`
            },
            printBackground: true
        }
    })

    if (!result?.buffer) throw new AppError('Failed to generate PDF document', 500)
    return result.buffer as Buffer
}

export async function generateOrderDocumentPdf(orderIds: string[], documentTitle?: string, lang?: DocumentLanguage) {
    if (!orderIds?.length) throw new AppError('No orders selected for document generation', 400)
    const documentLanguage = lang ?? readAppSettings().documentLanguage
    const title = documentTitle ?? invoiceTitle(documentLanguage)
    const slips = await buildSlipsForOrders(orderIds, title, documentLanguage)
    const pages = packSlipsIntoPages(slips)
    return renderOrderDocumentPdf(pages, 'order-document.ejs', documentLanguage)
}

export function resolveDocumentLanguage(req?: Request) {
    return getDocumentLanguage(req)
}

export { localizedReceiptTitle }
