export type LabelledAmount = {
    description: string
    amount: number
}

export function parseLabelledAmounts(value: unknown): LabelledAmount[] {
    if (Array.isArray(value)) {
        return value
            .map((row) => {
                if (!row || typeof row !== 'object') return null
                const description = String((row as LabelledAmount).description ?? '').trim()
                const amount = Number((row as LabelledAmount).amount)
                if (!description || !Number.isFinite(amount) || amount <= 0) return null
                return { description, amount }
            })
            .filter(Boolean) as LabelledAmount[]
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            return parseLabelledAmounts(JSON.parse(value))
        } catch {
            return []
        }
    }

    return []
}

export function sumLabelledAmounts(rows: LabelledAmount[]) {
    return rows.reduce((sum, row) => sum + row.amount, 0)
}

export function serializeLabelledAmounts(rows: LabelledAmount[]) {
    return JSON.stringify(rows)
}

/** Accept new arrays or legacy single additionalDiscount number. */
export function resolveAdditionalDiscounts(body: { additionalDiscounts?: unknown; additionalDiscount?: unknown }): LabelledAmount[] {
    const fromArray = parseLabelledAmounts(body.additionalDiscounts)
    if (fromArray.length) return fromArray

    const legacy = Number(body.additionalDiscount)
    if (Number.isFinite(legacy) && legacy > 0) {
        return [{ description: 'Additional discount', amount: legacy }]
    }
    return []
}

export function resolveAdditionalCharges(body: { additionalCharges?: unknown }): LabelledAmount[] {
    return parseLabelledAmounts(body.additionalCharges)
}
