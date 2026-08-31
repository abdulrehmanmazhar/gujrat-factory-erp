import { describe, expect, it } from 'vitest'
import {
    computeCustomerNet,
    computeCustomerOwed,
    computeSupplierPayable,
    customerTransactionDirection,
    orderOutstanding,
    restockOrderOutstanding,
    standaloneSupplierNet
} from '../../utils/ledger.js'

describe('ledger calculations', () => {
    it('never reports a negative customer order outstanding balance', () => {
        expect(orderOutstanding(100, 15, 20, 5)).toBe(70)
        expect(orderOutstanding(100, 150, 0)).toBe(0)
        expect(orderOutstanding(100, 0, 150)).toBe(0)
        expect(orderOutstanding(100, 0, 40, 0, 40)).toBe(100)
    })

    it('treats invoice charges and refunds as Out, payments and credits as In', () => {
        expect(customerTransactionDirection('order')).toBe('out')
        expect(customerTransactionDirection('refund')).toBe('out')
        expect(customerTransactionDirection('sale')).toBe('in')
        expect(customerTransactionDirection('udhar_payment')).toBe('in')
        expect(customerTransactionDirection('order_credit')).toBe('in')
    })

    it('derives customer net and owed after an unpaid then paid order', () => {
        const unpaid = [{ type: 'order', amount: 100 }]
        expect(computeCustomerNet(unpaid)).toBe(-100)
        expect(computeCustomerOwed(unpaid)).toBe(100)

        const partial = [
            { type: 'order', amount: 100 },
            { type: 'sale', amount: 40 }
        ]
        expect(computeCustomerNet(partial)).toBe(-60)
        expect(computeCustomerOwed(partial)).toBe(60)

        const cancelledWithRefund = [
            { type: 'order', amount: 100 },
            { type: 'sale', amount: 40 },
            { type: 'order_credit', amount: 100 },
            { type: 'refund', amount: 40 }
        ]
        expect(computeCustomerNet(cancelledWithRefund)).toBe(0)
        expect(computeCustomerOwed(cancelledWithRefund)).toBe(0)
    })

    it('only counts received restocks as payable', () => {
        expect(restockOrderOutstanding({ status: 'draft', totalAmount: 100, amountPaid: 0 })).toBe(0)
        expect(restockOrderOutstanding({ status: 'ordered', totalAmount: 100, amountPaid: 0 })).toBe(0)
        expect(restockOrderOutstanding({ status: 'received', totalAmount: 100, amountPaid: 25 })).toBe(75)
        expect(restockOrderOutstanding({ status: 'received', totalAmount: 100, amountPaid: 125 })).toBe(0)
    })

    it('separates standalone supplier ledger entries from restock-linked entries', () => {
        const net = standaloneSupplierNet([
            { type: 'purchase', amount: 100 },
            { type: 'payment', amount: 30 },
            { type: 'refund', amount: 20 },
            { type: 'return', amount: 10 },
            { restockOrderId: 'restock-1', type: 'purchase', amount: 999 }
        ])

        expect(net).toBe(80)
        expect(
            computeSupplierPayable(
                [
                    { status: 'received', totalAmount: 200, amountPaid: 50 },
                    { status: 'ordered', totalAmount: 300, amountPaid: 0 }
                ],
                net
            )
        ).toBe(230)
    })
})
