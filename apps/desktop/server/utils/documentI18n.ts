export type DocumentLanguage = 'en' | 'ur'

const copy = {
    en: {
        invoice: 'Invoice',
        paymentReceipt: 'Payment Receipt',
        refundReceipt: 'Refund Receipt',
        customer: 'Customer',
        contact: 'Contact',
        address: 'Address',
        prevDues: 'Prev. dues',
        booking: 'Booking',
        delivery: 'Delivery',
        bookedBy: 'Booked by',
        orderNumber: 'Order #',
        pageOf: 'Page {current} of {total}',
        description: 'Description',
        qty: 'Qty',
        unit: 'Unit',
        unitPrice: 'Rate',
        disc: 'Disc',
        total: 'Total',
        subtotal: 'Subtotal',
        discount: 'Discount',
        productDiscount: 'Product discount',
        charge: 'Charge',
        tax: 'Tax',
        paid: 'Paid',
        outstanding: 'Outstanding',
        grandTotal: 'Grand Total',
        message: 'Message',
        continued: 'Continued on next section…',
        thankYou: 'Thank you for your business!',
        amount: 'Amount',
        date: 'Date',
        note: 'Note',
        tel: 'Tel',
        orderConfirmation: 'Order Confirmation',
        items: 'Items',
        deliveryLabel: 'Delivery',
        amountReceived: 'Amount received',
        receiptAttached: 'Thank you. Your receipt is attached.',
        invoiceAttached: 'Thank you for your order. Your invoice is attached below.',
        paymentReminder: 'Payment Reminder',
        paymentReminderBody: 'Your order has been delivered. Please complete the remaining payment at your earliest convenience.',
        contactUs: 'For queries contact us',
        at: 'at',
        totalLabel: 'Total',
        pkr: 'PKR',
        grandTotalLabel: 'Grand total',
        qtyLine: '{n}. {desc} — {qty} {unit} @ {price} PKR',
        qtyLineSimple: '{n}. {desc} — {qty} {unit}'
    },
    ur: {
        invoice: 'انوائس',
        paymentReceipt: 'ادائیگی کی رسید',
        refundReceipt: 'واپسی کی رسید',
        customer: 'گاہک',
        contact: 'رابطہ',
        address: 'پتہ',
        prevDues: 'پچھلا بقایا',
        booking: 'بکنگ',
        delivery: 'ڈیلیوری',
        bookedBy: 'بک کرنے والا',
        orderNumber: 'آرڈر نمبر',
        pageOf: 'صفحہ {current} از {total}',
        description: 'تفصیل',
        qty: 'مقدار',
        unit: 'یونٹ',
        unitPrice: 'فی یونٹ',
        disc: 'رعایت',
        total: 'کل',
        subtotal: 'ذیلی کل',
        discount: 'رعایت',
        productDiscount: 'پروڈکٹ رعایت',
        charge: 'اضافی خرچ',
        tax: 'ٹیکس',
        paid: 'ادا شدہ',
        outstanding: 'بقایا',
        grandTotal: 'کل رقم',
        message: 'پیغام',
        continued: 'اگلے حصے میں جاری…',
        thankYou: 'آپ کے کاروبار کا شکریہ!',
        amount: 'رقم',
        date: 'تاریخ',
        note: 'نوٹ',
        tel: 'فون',
        orderConfirmation: 'آرڈر کی تصدیق',
        items: 'اشیاء',
        deliveryLabel: 'ڈیلیوری',
        amountReceived: 'وصول شدہ رقم',
        receiptAttached: 'شکریہ۔ آپ کی رسید منسلک ہے۔',
        invoiceAttached: 'آپ کے آرڈر کا شکریہ۔ انوائس نیچے منسلک ہے۔',
        paymentReminder: 'ادائیگی کی یاد دہانی',
        paymentReminderBody: 'آپ کا آرڈر ڈیلیور ہو چکا ہے۔ براہ کرم باقی رقم جلد ادا کریں۔',
        contactUs: 'سوالات کے لیے رابطہ کریں',
        at: 'پر',
        totalLabel: 'کل رقم',
        pkr: 'روپے',
        grandTotalLabel: 'کل رقم',
        qtyLine: '{n}. {desc} — {qty} {unit} @ {price} روپے',
        qtyLineSimple: '{n}. {desc} — {qty} {unit}'
    }
} as const

export type DocumentCopyKey = keyof typeof copy.en

export function normalizeDocumentLanguage(value?: string | null): DocumentLanguage {
    return value?.toLowerCase() === 'ur' ? 'ur' : 'en'
}

export function documentDir(lang: DocumentLanguage) {
    return lang === 'ur' ? 'rtl' : 'ltr'
}

export function tDoc(lang: DocumentLanguage, key: DocumentCopyKey) {
    return copy[lang][key] ?? copy.en[key]
}

export function formatDocPage(lang: DocumentLanguage, current: number, total: number) {
    return tDoc(lang, 'pageOf').replace('{current}', String(current)).replace('{total}', String(total))
}

export function getDocumentLabels(lang: DocumentLanguage) {
    const keys = Object.keys(copy.en) as DocumentCopyKey[]
    return Object.fromEntries(keys.map((key) => [key, tDoc(lang, key)])) as Record<DocumentCopyKey, string>
}

export function receiptTitle(lang: DocumentLanguage, type: string) {
    if (type === 'refund') return tDoc(lang, 'refundReceipt')
    return tDoc(lang, 'paymentReceipt')
}

export function invoiceTitle(lang: DocumentLanguage) {
    return tDoc(lang, 'invoice')
}

type SlipLine = { description: string; qty: number; unitPrice: number; unitName?: string }

function formatItemLine(lang: DocumentLanguage, n: number, line: SlipLine, breakdown: boolean, formatMoney: (value?: number | null) => string) {
    const unit = line.unitName?.trim() || 'pcs'
    const template = breakdown ? tDoc(lang, 'qtyLine') : tDoc(lang, 'qtyLineSimple')
    return template
        .replace('{n}', String(n))
        .replace('{desc}', line.description)
        .replace('{qty}', String(line.qty))
        .replace('{unit}', unit)
        .replace('{price}', formatMoney(line.unitPrice))
}

function formatLabelledAmountLines(
    lang: DocumentLanguage,
    rows: Array<{ description?: string; amount?: number }> | undefined,
    fallbackKey: DocumentCopyKey,
    formatMoney: (value?: number | null) => string
) {
    if (!rows?.length) return ''
    return rows.map((row) => `${row.description?.trim() || tDoc(lang, fallbackKey)}: ${formatMoney(row.amount)} ${tDoc(lang, 'pkr')}`).join('\n')
}

export function buildOrderConfirmationMessage(
    lang: DocumentLanguage,
    slip: {
        orderNumber?: string | null
        customer: { name: string; contact: string; address: string }
        lines: SlipLine[]
        lineNumberOffset: number
        deliveryDate: string
        discount: number
        lineDiscountTotal?: number
        additionalCharges?: Array<{ description?: string; amount?: number }>
        additionalDiscounts?: Array<{ description?: string; amount?: number }>
        invoiceBreakdown?: boolean
        grandTotal: number
    },
    formatMoney: (value?: number | null) => string
) {
    const breakdown = slip.invoiceBreakdown !== false
    const itemLines = slip.lines
        .map((line, index) => formatItemLine(lang, slip.lineNumberOffset + index + 1, line, breakdown, formatMoney))
        .join('\n')

    const totals: string[] = []
    if (breakdown) {
        if ((slip.lineDiscountTotal ?? 0) > 0) {
            totals.push(`${tDoc(lang, 'productDiscount')}: ${formatMoney(slip.lineDiscountTotal)} ${tDoc(lang, 'pkr')}`)
        }
        const chargeLines = formatLabelledAmountLines(lang, slip.additionalCharges, 'charge', formatMoney)
        if (chargeLines) totals.push(chargeLines)
        const discountLines = formatLabelledAmountLines(lang, slip.additionalDiscounts, 'discount', formatMoney)
        if (discountLines) totals.push(discountLines)
    }

    return `*${tDoc(lang, 'orderConfirmation')}*

${tDoc(lang, 'orderNumber')}${slip.orderNumber ?? '—'}
${tDoc(lang, 'customer')}: ${slip.customer.name}
${tDoc(lang, 'contact')}: ${slip.customer.contact}
${tDoc(lang, 'address')}: ${slip.customer.address}

*${tDoc(lang, 'items')}*
${itemLines}

${tDoc(lang, 'deliveryLabel')}: ${slip.deliveryDate}
${totals.length ? `${totals.join('\n')}\n` : ''}${tDoc(lang, 'totalLabel')}: ${formatMoney(slip.grandTotal)} ${tDoc(lang, 'pkr')}

${tDoc(lang, 'invoiceAttached')}`
}

export function buildReceiptWhatsAppMessage(
    lang: DocumentLanguage,
    slip: {
        orderNumber?: string | null
        customer: { name: string; contact: string; address: string }
        lines: SlipLine[]
        lineNumberOffset: number
        deliveryDate: string
        invoiceBreakdown?: boolean
        additionalCharges?: Array<{ description?: string; amount?: number }>
        additionalDiscounts?: Array<{ description?: string; amount?: number }>
        lineDiscountTotal?: number
        grandTotal: number
        outstanding: number
    },
    txnType: string,
    amount: number,
    formatMoney: (value?: number | null) => string
) {
    const breakdown = slip.invoiceBreakdown !== false
    const itemLines = slip.lines
        .map((line, index) => formatItemLine(lang, slip.lineNumberOffset + index + 1, line, breakdown, formatMoney))
        .join('\n')

    const totals: string[] = []
    if (breakdown) {
        if ((slip.lineDiscountTotal ?? 0) > 0) {
            totals.push(`${tDoc(lang, 'productDiscount')}: ${formatMoney(slip.lineDiscountTotal)} ${tDoc(lang, 'pkr')}`)
        }
        const chargeLines = formatLabelledAmountLines(lang, slip.additionalCharges, 'charge', formatMoney)
        if (chargeLines) totals.push(chargeLines)
        const discountLines = formatLabelledAmountLines(lang, slip.additionalDiscounts, 'discount', formatMoney)
        if (discountLines) totals.push(discountLines)
    }

    return `*${receiptTitle(lang, txnType)}*

${tDoc(lang, 'orderNumber')}${slip.orderNumber ?? '—'}
${tDoc(lang, 'customer')}: ${slip.customer.name}
${tDoc(lang, 'contact')}: ${slip.customer.contact}
${tDoc(lang, 'address')}: ${slip.customer.address}

*${tDoc(lang, 'items')}*
${itemLines}

${tDoc(lang, 'deliveryLabel')}: ${slip.deliveryDate}
${totals.length ? `${totals.join('\n')}\n` : ''}${tDoc(lang, 'amountReceived')}: ${formatMoney(amount)} ${tDoc(lang, 'pkr')}
${tDoc(lang, 'grandTotalLabel')}: ${formatMoney(slip.grandTotal)} ${tDoc(lang, 'pkr')}
${tDoc(lang, 'outstanding')}: ${formatMoney(slip.outstanding)} ${tDoc(lang, 'pkr')}

${tDoc(lang, 'receiptAttached')}`
}

export function buildPaymentReminderWhatsAppMessage(
    lang: DocumentLanguage,
    order: {
        orderNumber?: string | null
        price?: number | null
        discount?: number | null
        charges?: number | null
        payment?: number | null
    },
    customer: { name: string },
    outstanding: number,
    companyPhone?: string
) {
    const payable = Math.max((order.price ?? 0) + (order.charges ?? 0) - (order.discount ?? 0), 0)
    const paid = order.payment ?? 0

    const contactLine = companyPhone ? `${tDoc(lang, 'contactUs')} ${tDoc(lang, 'at')} ${companyPhone}.` : `${tDoc(lang, 'contactUs')}.`

    return `*${tDoc(lang, 'paymentReminder')}*

${tDoc(lang, 'orderNumber')}${order.orderNumber ?? '—'}
${tDoc(lang, 'customer')}: ${customer.name}
${tDoc(lang, 'totalLabel')}: ${payable.toLocaleString()} ${tDoc(lang, 'pkr')}
${tDoc(lang, 'paid')}: ${paid.toLocaleString()} ${tDoc(lang, 'pkr')}
${tDoc(lang, 'outstanding')}: ${outstanding.toLocaleString()} ${tDoc(lang, 'pkr')}

${tDoc(lang, 'paymentReminderBody')}

${contactLine}`
}
