import { describe, expect, it } from 'vitest'
import calculateBill from '../../utils/calculateBill.js'
import calculateDiscount from '../../utils/calculateDiscount.js'
import {
    parseLabelledAmounts,
    resolveAdditionalCharges,
    resolveAdditionalDiscounts,
    serializeLabelledAmounts,
    sumLabelledAmounts
} from '../../utils/labelledAmounts.js'
import { canDelete, canWrite, roleCanAccess } from '../../utils/roles.js'
import { aggregateOrderSheetLines, groupOrderSheetByCategory } from '../../utils/orderSheet.js'
import { resolveConversionAmounts } from '../../services/conversion.service.js'

describe('business rule utilities', () => {
    it('calculates cart totals and discounts from quantities', () => {
        const cart = [
            { qty: 2, product: { price: 25, discount: 2 } },
            { qty: 3, product: { price: 10, discount: 1 } }
        ]

        expect(calculateBill(cart)).toBe(80)
        expect(calculateDiscount(cart)).toBe(7)
    })

    it('accepts valid labelled amounts and rejects malformed/negative values', () => {
        const values = parseLabelledAmounts([
            { description: 'Delivery', amount: '15' },
            { description: '', amount: 10 },
            { description: 'Invalid', amount: -1 },
            null
        ])

        expect(values).toEqual([{ description: 'Delivery', amount: 15 }])
        expect(sumLabelledAmounts(values)).toBe(15)
        expect(parseLabelledAmounts(serializeLabelledAmounts(values))).toEqual(values)
        expect(resolveAdditionalDiscounts({ additionalDiscount: 20 })).toEqual([
            { description: 'Additional discount', amount: 20 }
        ])
        expect(resolveAdditionalCharges({ additionalCharges: 'not-json' })).toEqual([])
    })

    it('resolves conversion quantities and rejects ambiguous/invalid quantities', () => {
        expect(resolveConversionAmounts(2, 3, 10)).toEqual({ inputQty: 10, outputQty: 15 })
        expect(resolveConversionAmounts(2, 3, undefined, 15)).toEqual({ inputQty: 10, outputQty: 15 })
        expect(() => resolveConversionAmounts(2, 3, 10, 15)).toThrow(/either input quantity or output quantity/i)
        expect(() => resolveConversionAmounts(2, 3)).toThrow(/either input quantity or output quantity/i)
        expect(() => resolveConversionAmounts(2, 3, 0)).toThrow(/positive/i)
    })

    it('aggregates selected order items by product with summed quantities', () => {
        const rows = aggregateOrderSheetLines([
            { productId: 'chair', productName: 'Chair', unitName: 'pcs', qty: 2, categoryLabel: 'Furniture / Seating' },
            { productId: 'chair', productName: 'Chair', unitName: 'pcs', qty: 3, categoryLabel: 'Furniture / Seating' },
            { productId: 'table', productName: 'Table', unitName: 'pcs', qty: 1, categoryLabel: 'Furniture / Tables' },
            { productId: 'skip', productName: 'Zero', unitName: 'pcs', qty: 0, categoryLabel: 'Ignore' }
        ])

        expect(rows).toEqual([
            { productId: 'chair', product: 'Chair', unit: 'pcs', qty: 5, category: 'Furniture / Seating' },
            { productId: 'table', product: 'Table', unit: 'pcs', qty: 1, category: 'Furniture / Tables' }
        ])
    })

    it('groups order sheet lines by category with summed quantities', () => {
        const grouped = groupOrderSheetByCategory([
            { productId: 'chair', product: 'Chair', unit: 'pcs', qty: 5, category: 'Furniture / Seating' },
            { productId: 'stool', product: 'Stool', unit: 'pcs', qty: 2, category: 'Furniture / Seating' },
            { productId: 'table', product: 'Table', unit: 'pcs', qty: 1, category: 'Furniture / Tables' }
        ])

        expect(grouped).toEqual([
            {
                category: 'Furniture / Seating',
                qty: 7,
                items: [
                    { productId: 'chair', product: 'Chair', unit: 'pcs', qty: 5, category: 'Furniture / Seating' },
                    { productId: 'stool', product: 'Stool', unit: 'pcs', qty: 2, category: 'Furniture / Seating' }
                ]
            },
            {
                category: 'Furniture / Tables',
                qty: 1,
                items: [{ productId: 'table', product: 'Table', unit: 'pcs', qty: 1, category: 'Furniture / Tables' }]
            }
        ])
    })

    it('enforces write and delete role hierarchy', () => {
        expect(canWrite('User')).toBe(false)
        expect(canWrite('admin')).toBe(true)
        expect(canWrite('super_admin')).toBe(true)
        expect(canDelete('admin')).toBe(false)
        expect(canDelete('super_admin')).toBe(true)
        expect(roleCanAccess('admin', 'super_admin')).toBe(true)
        expect(roleCanAccess('super_admin', 'admin')).toBe(false)
    })
})
