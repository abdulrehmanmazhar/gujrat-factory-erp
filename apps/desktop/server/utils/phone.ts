import { AppError } from './errors.js'

/** Normalize to 12-digit Pakistan WhatsApp number: 92XXXXXXXXXX */
export function normalizeWhatsAppContact(contact: string) {
    let normalized = contact.replace(/[^0-9]/g, '')
    if (normalized.startsWith('0')) normalized = `92${normalized.slice(1)}`
    else if (normalized.startsWith('0092')) normalized = normalized.slice(2)
    else if (normalized.startsWith('+92')) normalized = normalized.slice(1)
    else if (!normalized.startsWith('92')) normalized = `92${normalized}`
    return normalized.length === 12 ? normalized : null
}

export function assertValidWhatsAppContact(contact: string, label = 'WhatsApp number') {
    const normalized = normalizeWhatsAppContact(contact)
    if (!normalized) {
        throw new AppError(`${label} must be a valid Pakistan WhatsApp number (e.g. 03XX XXXXXXX)`, 400)
    }
    return normalized
}
