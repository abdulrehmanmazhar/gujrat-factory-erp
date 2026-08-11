import type { Product, StockByUnit } from '@/types/api'

export function formatStockQty(qty: number): string {
    if (!Number.isFinite(qty)) return '0'
    if (Number.isInteger(qty)) return String(qty)
    return qty.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function formatStockByUnit(items?: StockByUnit[] | null): string {
    if (!items?.length) return ''
    return items
        .filter((item) => Number.isFinite(item.qty))
        .map((item) => `${formatStockQty(item.qty)} ${item.unitName}`.trim())
        .join(' · ')
}

export function sumProductsStockByUnit(products: Product[]): StockByUnit[] {
    const map = new Map<string, StockByUnit>()
    for (const product of products) {
        const unitId = product.unitId ?? product.unit?.id ?? product.unit?._id ?? ''
        const unitName = product.unit?.name?.trim() || 'pcs'
        const key = unitId || unitName
        const qty = Number(product.stockQty) || 0
        const existing = map.get(key)
        if (existing) existing.qty += qty
        else map.set(key, { unitId: unitId || null, unitName, qty })
    }
    return [...map.values()].sort((a, b) => a.unitName.localeCompare(b.unitName))
}
