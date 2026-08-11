import { randomUUID } from 'crypto'

export function createId() {
    return randomUUID()
}

export function withLegacyId<T extends { id: string }>(row: T) {
    const { id, ...rest } = row
    return { ...rest, _id: id, id }
}

export function withLegacyIds<T extends { id: string }>(rows: T[]) {
    return rows.map(withLegacyId)
}

export function mapUser(user: {
    id: string
    name: string
    contact: string
    role: string
    isVerified: boolean
    avatarPublicId: string | null
    avatarUrl: string | null
    password?: string | null
    createdAt: Date
    updatedAt: Date
}) {
    const legacy = withLegacyId(user)
    return {
        ...legacy,
        avatar: user.avatarPublicId || user.avatarUrl ? { public_id: user.avatarPublicId, url: user.avatarUrl } : undefined
    }
}

export function mapOrderWithCart(
    order: Record<string, unknown>,
    items: Array<{
        id: string
        productId: string
        qty: number
        unitPrice: number
        unitDiscount: number
        product: Record<string, unknown>
    }>
) {
    let additionalCharges: Array<{ description: string; amount: number }> = []
    let additionalDiscounts: Array<{ description: string; amount: number }> = []
    try {
        additionalCharges = JSON.parse(String(order.additionalChargesJson ?? '[]'))
        if (!Array.isArray(additionalCharges)) additionalCharges = []
    } catch {
        additionalCharges = []
    }
    try {
        additionalDiscounts = JSON.parse(String(order.additionalDiscountsJson ?? '[]'))
        if (!Array.isArray(additionalDiscounts)) additionalDiscounts = []
    } catch {
        additionalDiscounts = []
    }

    return {
        ...withLegacyId(order as { id: string }),
        customerId: order.customerId,
        createdBy: order.createdById,
        charges: Number(order.charges ?? 0),
        additionalCharges,
        additionalDiscounts,
        invoiceBreakdown: order.invoiceBreakdown !== false && order.invoiceBreakdown !== 0,
        cart: items.map((item) => ({
            product: withLegacyId(item.product as { id: string }),
            qty: item.qty,
            unitPrice: item.unitPrice,
            unitDiscount: item.unitDiscount
        }))
    }
}
