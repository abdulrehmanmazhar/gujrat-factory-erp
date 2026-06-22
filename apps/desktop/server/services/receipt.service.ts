// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import { generatePDF } from 'pdf-node'
import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, transactions } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { moduleDir } from '../utils/esm.js'
import { enqueueWhatsAppDocument, enqueueWhatsAppText } from '../utils/whatsappQueue.js'
import * as orderService from './order.service.js'

const templatesDir = path.join(moduleDir(import.meta.url), '../templates')

const company = {
    name: process.env.COMPANY_NAME || 'Gujrat Factory ERP',
    address: process.env.COMPANY_ADDRESS || 'Kolo Road Hafizabad',
    phone: process.env.COMPANY_PHONE || '+92 347 3919512'
}

function receiptTitle(type: string) {
    if (type === 'order_refund') return 'Refund Receipt'
    return 'Payment Receipt'
}

function receiptDescription(type: string, orderNumber?: number | null) {
    if (type === 'order_refund') return `Refund processed for order #${orderNumber ?? '—'}`
    if (type === 'sale') return `Payment received for order #${orderNumber ?? '—'}`
    return 'Transaction receipt'
}

function buildReceiptMessage(type: string, amount: number, orderNumber?: number | null, customerName?: string) {
    const label = receiptTitle(type)
    return `*${label}*

${customerName ? `Customer: ${customerName}\n` : ''}${orderNumber ? `Order #${orderNumber}\n` : ''}Amount: ${amount.toLocaleString()} PKR

Thank you. Your receipt is attached.`
}

export async function generateReceiptPdf(transactionId: string) {
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1)
    if (!txn) throw new AppError('Transaction not found', 404)

    let orderNumber: number | null = null
    let customerName: string | undefined

    if (txn.orderId) {
        const order = await orderService.getOrder(txn.orderId)
        orderNumber = order.orderNumber ?? null
        const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
        customerName = customer?.name
    }

    const html = fs.readFileSync(path.join(templatesDir, 'receipt.ejs'), 'utf8')
    const result = await generatePDF({
        html,
        data: {
            title: receiptTitle(txn.type),
            company,
            date: new Date(txn.createdAt).toLocaleString('en-GB'),
            orderNumber,
            customerName,
            description: txn.description || receiptDescription(txn.type, orderNumber),
            amount: txn.amount
        },
        engine: 'ejs',
        type: 'pdf',
        buffer: true,
        pdfOptions: { format: 'A4', orientation: 'portrait', border: '8mm' }
    })

    if (!result?.buffer) throw new AppError('Failed to generate receipt PDF', 500)
    return { buffer: result.buffer as Buffer, txn, orderNumber, customerName }
}

export async function queueTransactionReceiptWhatsApp(transactionId: string) {
    const { buffer, txn, orderNumber, customerName } = await generateReceiptPdf(transactionId)

    if (!txn.orderId) return

    const order = await orderService.getOrder(txn.orderId)
    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    if (!customer?.contact) return

    const message = buildReceiptMessage(txn.type, txn.amount, orderNumber, customerName ?? customer.name)
    const fileName =
        txn.type === 'order_refund' ? `Refund-${orderNumber ?? txn.id.slice(0, 8)}.pdf` : `Receipt-${orderNumber ?? txn.id.slice(0, 8)}.pdf`

    await enqueueWhatsAppText(customer.contact, message)
    await enqueueWhatsAppDocument(customer.contact, fileName, buffer)
}
