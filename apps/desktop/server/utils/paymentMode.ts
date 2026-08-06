import { AppError } from './errors.js'

export const PAYMENT_MODES = ['cash', 'online'] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export type PaymentProofFields = {
    paymentMode: PaymentMode
    proofImage?: string
    proofImagePublicId?: string
}

export function assertPaymentMode(value: unknown, fallback: PaymentMode = 'cash'): PaymentMode {
    if (value === undefined || value === null || value === '') return fallback
    const mode = String(value)
    if (!PAYMENT_MODES.includes(mode as PaymentMode)) {
        throw new AppError('Payment mode must be cash or online', 400)
    }
    return mode as PaymentMode
}

export function parsePaymentProofFromBody(body: Record<string, unknown>, uploaded?: { url?: string; remotePath?: string }): PaymentProofFields {
    return {
        paymentMode: assertPaymentMode(body.paymentMode),
        proofImage: uploaded?.url ?? uploaded?.remotePath,
        proofImagePublicId: uploaded?.remotePath
    }
}
