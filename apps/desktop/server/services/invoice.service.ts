// @ts-nocheck
import { logger } from '../config/logger.js'
import { formatWhatsAppContact } from '../utils/whatsapp.js'
import { readAppSettings } from '../utils/appSettings.js'
import { buildOrderConfirmationMessage, invoiceTitle, type DocumentLanguage } from '../utils/documentI18n.js'
import {
    buildInvoiceOrder,
    buildSlipsFromOrder,
    formatMoney,
    generateOrderDocumentPdf,
    packSlipsIntoPages,
    renderOrderDocumentPdf
} from './document.service.js'

export async function generateOrderInvoicePdf(orderId: string, lang?: DocumentLanguage) {
    return generateInvoicesPdf([orderId], lang)
}

export async function queueOrderInvoiceWhatsApp(orderId: string, lang?: DocumentLanguage) {
    const documentLanguage = lang ?? readAppSettings().documentLanguage
    const builtOrder = await buildInvoiceOrder(orderId)
    const contact = formatWhatsAppContact(builtOrder.customer.contact)
    if (!contact || !builtOrder.deliveryDate) return

    const slips = buildSlipsFromOrder(builtOrder, { lang: documentLanguage })
    const payload = slips[0]
    const message = buildOrderConfirmationMessage(documentLanguage, payload, formatMoney)
    const orderNumber = payload.orderNumber ?? null
    const fileName = `${invoiceTitle(documentLanguage)}-${orderNumber ?? orderId.slice(0, 8)}.pdf`
    const meta = {
        customerId: builtOrder.customerId,
        orderId,
        docType: 'invoice' as const,
        orderNumber: typeof orderNumber === 'number' ? orderNumber : null,
        displayName: fileName
    }

    try {
        const pdfBuffer = await generateOrderInvoicePdf(orderId, documentLanguage)
        const { enqueueWhatsAppText, enqueueWhatsAppDocument } = await import('../utils/whatsappQueue.js')
        await enqueueWhatsAppText(contact, message, { ...meta, docType: 'text', displayName: 'Invoice message' })
        await enqueueWhatsAppDocument(contact, fileName, pdfBuffer, undefined, meta)
    } catch (error) {
        logger.error('Error queueing WhatsApp order invoice', { meta: { error, orderId } })
    }
}

/** @deprecated use queueOrderInvoiceWhatsApp */
export async function sendOrderReceiptWhatsApp(orderId: string) {
    return queueOrderInvoiceWhatsApp(orderId)
}

export async function generateInvoicesPdf(orderIds: string[], lang?: DocumentLanguage) {
    const documentLanguage = lang ?? readAppSettings().documentLanguage
    return generateOrderDocumentPdf(orderIds, invoiceTitle(documentLanguage), documentLanguage)
}

export { buildInvoiceOrder, generateOrderDocumentPdf, packSlipsIntoPages, renderOrderDocumentPdf }
