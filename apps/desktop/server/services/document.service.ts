// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import { generatePDF } from 'pdf-node'
import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, users } from '../models/tables.js'
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
import type { Request } from 'express'

export const ITEMS_PER_SLIP = 10
export const SLIPS_PER_PAGE = 3
const PDF_MARGIN_MM = 4
const A4_HEIGHT_MM = 297
/** Printable A4 height minus margins, divided evenly across slips per sheet */
export const SLIP_HEIGHT_MM = (A4_HEIGHT_MM - PDF_MARGIN_MM * 2) / SLIPS_PER_PAGE

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

    return {
        ...order,
        customer: customer ?? {
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
        const unitPrice = item.product?.price ?? item.unitPrice ?? 0
        const unitDiscount = item.product?.discount ?? item.unitDiscount ?? 0
        const qty = item.qty ?? 0
        return {
            description: `${item.product?.name ?? 'Product'}${item.product?.category ? ` (${item.product.category})` : ''}`,
            qty,
            unitPrice,
            discount: unitDiscount,
            total: unitPrice * qty - unitDiscount * qty
        }
    })
}

function chunkCart<T>(cart: T[], size = ITEMS_PER_SLIP) {
    if (!cart.length) return [[]]
    const chunks: T[][] = []
    for (let i = 0; i < cart.length; i += size) {
        chunks.push(cart.slice(i, i + size))
    }
    return chunks
}

function padLines(lines: Array<Record<string, unknown> | null>) {
    const padded = [...lines]
    while (padded.length < ITEMS_PER_SLIP) padded.push(null)
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
    const price = order.price ?? 0
    const discount = order.discount ?? 0
    const grandTotal = Math.max(price - discount, 0)
    const paid = order.payment ?? 0
    const cartChunks = chunkCart(order.cart ?? [])
    const allLines = mapCartLines(order.cart ?? [])

    return cartChunks.map((cartChunk, index) => {
        const lines = mapCartLines(cartChunk)
        const lineNumberOffset = index * ITEMS_PER_SLIP

        return {
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
            price,
            discount,
            grandTotal,
            paid,
            outstanding: Math.max(grandTotal - paid, 0),
            lines,
            paddedLines: padLines(lines),
            partIndex: index + 1,
            partTotal: cartChunks.length,
            showTotals: index === cartChunks.length - 1,
            lineNumberOffset,
            allLinesCount: allLines.length,
            receipt: options.receipt ?? null
        }
    })
}

export function packSlipsIntoPages(slips: ReturnType<typeof buildSlipsFromOrder>) {
    const pages: Array<{ slips: Array<(typeof slips)[number] | null> }> = []

    for (let i = 0; i < slips.length; i += SLIPS_PER_PAGE) {
        const pageSlips: Array<(typeof slips)[number] | null> = []
        for (let j = 0; j < SLIPS_PER_PAGE; j++) {
            pageSlips.push(slips[i + j] ?? null)
        }
        pages.push({ slips: pageSlips })
    }

    return pages
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
            itemsPerSlip: ITEMS_PER_SLIP,
            lang: documentLanguage,
            dir,
            labels,
            fontCss: getDocumentFontCss(documentLanguage),
            fontFamily: getDocumentFontFamily(documentLanguage),
            slipHeightMm: `${SLIP_HEIGHT_MM}mm`,
            slipsPerPage: SLIPS_PER_PAGE,
            itemRowHeightPercent: 100 / ITEMS_PER_SLIP,
            formatPage: (current: number, total: number) => formatDocPage(documentLanguage, current, total)
        },
        engine: 'ejs',
        type: 'pdf',
        buffer: true,
        pdfOptions: {
            format: 'A4',
            orientation: 'portrait',
            border: '4mm',
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
