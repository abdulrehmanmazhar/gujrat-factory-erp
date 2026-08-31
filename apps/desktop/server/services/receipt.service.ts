// @ts-nocheck
import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { enqueueWhatsAppDocument, enqueueWhatsAppText } from '../utils/whatsappQueue.js'
import { readAppSettings } from '../utils/appSettings.js'
import { buildReceiptWhatsAppMessage, receiptTitle, type DocumentLanguage } from '../utils/documentI18n.js'
import { getCustomerTransactionWithDetails } from './customerTransaction.service.js'
import {
    buildInvoiceOrder,
    buildSlipsFromOrder,
    formatDateTime,
    formatMoney,
    packSlipsIntoPages,
    renderOrderDocumentPdf
} from './document.service.js'

export async function generateReceiptPdf(transactionId: string, lang?: DocumentLanguage) {
    const documentLanguage = lang ?? readAppSettings().documentLanguage
    const txn = await getCustomerTransactionWithDetails(transactionId)
    if (!txn) throw new AppError('Transaction not found', 404)

    if (!txn.orderId) {
        throw new AppError('Receipt requires an associated order', 400)
    }

    const builtOrder = await buildInvoiceOrder(txn.orderId)
    const [customer] = await db.select().from(customers).where(eq(customers.id, builtOrder.customerId)).limit(1)
    const title = receiptTitle(documentLanguage, txn.type)

    const slips = buildSlipsFromOrder(builtOrder, {
        documentTitle: title,
        lang: documentLanguage,
        receipt: {
            type: title,
            amount: txn.amount,
            date: formatDateTime(txn.createdAt),
            description: txn.description ?? ''
        }
    })

    const pages = packSlipsIntoPages(slips)
    const buffer = await renderOrderDocumentPdf(pages, 'order-document.ejs', documentLanguage)

    return {
        buffer,
        txn,
        orderNumber: builtOrder.orderNumber ?? null,
        customerName: customer?.name ?? builtOrder.customer.name,
        slip: slips[0]
    }
}

export async function queueTransactionReceiptWhatsApp(transactionId: string, lang?: DocumentLanguage) {
    const documentLanguage = lang ?? readAppSettings().documentLanguage
    const { buffer, txn, orderNumber, slip } = await generateReceiptPdf(transactionId, documentLanguage)

    if (!txn.orderId) return

    const [customer] = await db.select().from(customers).where(eq(customers.id, txn.customerId)).limit(1)
    if (!customer?.contact) return

    const message = buildReceiptWhatsAppMessage(documentLanguage, slip, txn.type, txn.amount, formatMoney)
    const title = receiptTitle(documentLanguage, txn.type)
    const fileName = `${title}-${orderNumber ?? txn.id.slice(0, 8)}.pdf`
    const meta = {
        customerId: txn.customerId,
        orderId: txn.orderId,
        transactionId: txn.id,
        docType: 'receipt' as const,
        orderNumber: typeof orderNumber === 'number' ? orderNumber : null,
        displayName: fileName
    }

    await enqueueWhatsAppText(customer.contact, message, { ...meta, docType: 'text', displayName: 'Receipt message' })
    await enqueueWhatsAppDocument(customer.contact, fileName, buffer, undefined, meta)
}
