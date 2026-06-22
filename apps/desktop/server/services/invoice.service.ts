// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import { generatePDF } from 'pdf-node'
import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { moduleDir } from '../utils/esm.js'
import { logger } from '../config/logger.js'
import { formatWhatsAppContact } from '../utils/whatsapp.js'
import * as orderService from './order.service.js'

const templatesDir = path.join(moduleDir(import.meta.url), '../templates')

const company = {
    name: process.env.COMPANY_NAME || 'Gujrat Factory ERP',
    address: process.env.COMPANY_ADDRESS || 'Kolo Road Hafizabad',
    phone: process.env.COMPANY_PHONE || '+92 347 3919512'
}

function formatDate(value?: Date | string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-GB')
}

function formatDateTime(value?: Date | string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-GB')
}

function splitOrdersByCartLimit(orderList: Awaited<ReturnType<typeof buildInvoiceOrder>>[], cartLimit = 10) {
    const result = []
    for (const order of orderList) {
        if (order.cart.length <= cartLimit) {
            result.push(order)
            continue
        }
        let remaining = [...order.cart]
        while (remaining.length > cartLimit) {
            result.push({ ...order, cart: remaining.splice(0, cartLimit) })
        }
        if (remaining.length) {
            result.push({ ...order, cart: remaining })
        }
    }
    return result
}

async function buildInvoiceOrder(orderId: string) {
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
            businessName: '',
            address: '—',
            udhar: 0
        },
        orderBooker: booker?.name ?? order.userDetails?.name ?? 'Unknown',
        cart: order.cart ?? []
    }
}

function mapToInvoicePayload(order: Awaited<ReturnType<typeof buildInvoiceOrder>>) {
    const price = order.price ?? 0
    const discount = order.discount ?? 0
    return {
        orderNumber: order.orderNumber,
        customer: {
            name: order.customer.name,
            businessName: order.customer.businessName,
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
        grandTotal: price - discount,
        lines: (order.cart ?? []).map((item) => {
            const unitPrice = item.product?.price ?? item.unitPrice ?? 0
            const unitDiscount = item.product?.discount ?? item.unitDiscount ?? 0
            const qty = item.qty ?? 0
            return {
                description: `${item.product?.name ?? 'Product'} (${item.product?.category ?? ''})`,
                qty,
                unitPrice,
                discount: unitDiscount,
                total: unitPrice * qty - unitDiscount * qty
            }
        })
    }
}

function buildReceiptMessage(payload: ReturnType<typeof mapToInvoicePayload>) {
    const itemLines = payload.lines
        .map((line, index) => `${index + 1}. ${line.description} — Qty ${line.qty} @ ${line.unitPrice.toLocaleString()} PKR`)
        .join('\n')

    const businessLine = payload.customer.businessName ? `Business: ${payload.customer.businessName}\n` : ''

    return `*Order Confirmation*

Order #${payload.orderNumber}
${businessLine}Customer: ${payload.customer.name}
Contact: ${payload.customer.contact}
Address: ${payload.customer.address}

*Items*
${itemLines}

Delivery: ${payload.deliveryDate}
Discount: ${payload.discount.toLocaleString()} PKR
Total: ${payload.grandTotal.toLocaleString()} PKR

Thank you for your order. Your invoice is attached below.`
}

export async function generateOrderInvoicePdf(orderId: string) {
    return generateInvoicesPdf([orderId])
}

export async function queueOrderInvoiceWhatsApp(orderId: string) {
    const builtOrder = await buildInvoiceOrder(orderId)
    const contact = formatWhatsAppContact(builtOrder.customer.contact)
    if (!contact || !builtOrder.deliveryDate) return

    const payload = mapToInvoicePayload(builtOrder)
    const message = buildReceiptMessage(payload)
    const fileName = `Invoice-${payload.orderNumber ?? orderId.slice(0, 8)}.pdf`

    try {
        const pdfBuffer = await generateOrderInvoicePdf(orderId)
        const { enqueueWhatsAppText, enqueueWhatsAppDocument } = await import('../utils/whatsappQueue.js')
        await enqueueWhatsAppText(contact, message)
        await enqueueWhatsAppDocument(contact, fileName, pdfBuffer)
    } catch (error) {
        logger.error('Error queueing WhatsApp order invoice', { meta: { error, orderId } })
    }
}

/** @deprecated use queueOrderInvoiceWhatsApp */
export async function sendOrderReceiptWhatsApp(orderId: string) {
    return queueOrderInvoiceWhatsApp(orderId)
}

export async function generateInvoicesPdf(orderIds: string[]) {
    if (!orderIds?.length) throw new AppError('No orders selected for invoice generation', 400)

    const uniqueIds = [...new Set(orderIds)]
    const builtOrders = await Promise.all(uniqueIds.map((id) => buildInvoiceOrder(id)))
    const split = splitOrdersByCartLimit(builtOrders, 10)
    const invoices = split.map(mapToInvoicePayload)

    const html = fs.readFileSync(path.join(templatesDir, 'invoices.ejs'), 'utf8')

    const result = await generatePDF({
        html,
        data: { invoices, company },
        engine: 'ejs',
        type: 'pdf',
        buffer: true,
        pdfOptions: {
            format: 'A4',
            orientation: 'portrait',
            border: '8mm'
        }
    })

    if (!result?.buffer) throw new AppError('Failed to generate invoice PDF', 500)
    return result.buffer as Buffer
}
