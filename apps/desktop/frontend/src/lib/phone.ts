export const WHATSAPP_NUMBER_HINT = 'Pakistan WhatsApp number, e.g. 03XX XXXXXXX'

/** Normalize to 12-digit Pakistan WhatsApp number: 92XXXXXXXXXX */
export function normalizeWhatsAppContact(contact: string) {
    let normalized = contact.replace(/[^0-9]/g, '')
    if (normalized.startsWith('0')) normalized = `92${normalized.slice(1)}`
    else if (normalized.startsWith('0092')) normalized = normalized.slice(2)
    else if (normalized.startsWith('+92')) normalized = normalized.slice(1)
    else if (!normalized.startsWith('92')) normalized = `92${normalized}`
    return normalized.length === 12 ? normalized : null
}

export function isValidWhatsAppContact(contact: string) {
    return normalizeWhatsAppContact(contact) !== null
}

export function formatDisplayContact(contact: string) {
    const normalized = normalizeWhatsAppContact(contact)
    return normalized ? `+${normalized}` : contact
}
