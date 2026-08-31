export type OrderSheetLineInput = {
    productId: string
    productName: string
    unitName: string
    qty: number
    categoryLabel: string
}

export type AggregatedOrderSheetLine = {
    productId: string
    product: string
    unit: string
    qty: number
    category: string
}

export type OrderSheetCategoryGroup = {
    category: string
    items: AggregatedOrderSheetLine[]
    qty: number
}

export function aggregateOrderSheetLines(lines: OrderSheetLineInput[]): AggregatedOrderSheetLine[] {
    const map = new Map<string, AggregatedOrderSheetLine>()
    for (const line of lines) {
        const qty = Number(line.qty) || 0
        if (qty <= 0) continue
        const existing = map.get(line.productId)
        if (existing) {
            existing.qty += qty
            continue
        }
        map.set(line.productId, {
            productId: line.productId,
            product: line.productName,
            unit: line.unitName,
            qty,
            category: line.categoryLabel || 'Uncategorized'
        })
    }
    return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.product.localeCompare(b.product))
}

export function groupOrderSheetByCategory(lines: AggregatedOrderSheetLine[]): OrderSheetCategoryGroup[] {
    const groups = new Map<string, AggregatedOrderSheetLine[]>()
    for (const line of lines) {
        const key = line.category.trim() || 'Uncategorized'
        const list = groups.get(key) ?? []
        list.push(line)
        groups.set(key, list)
    }

    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, items]) => ({
            category,
            items,
            qty: items.reduce((sum, item) => sum + item.qty, 0)
        }))
}
