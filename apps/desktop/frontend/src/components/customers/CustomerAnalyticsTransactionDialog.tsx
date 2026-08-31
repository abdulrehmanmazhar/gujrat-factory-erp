import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PaymentProofFields, usePaymentProofFields } from '@/components/shared/PaymentProofFields'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateCustomerKhataMutation } from '@/redux/api/khataApi'
import { useAddOrderPaymentMutation, useGetOrdersQuery, useRecordOrderRefundMutation } from '@/redux/api/ordersApi'
import { useGetCustomersQuery } from '@/redux/api/customersApi'
import type { KhataDirection, Order } from '@/types/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const STANDALONE = 'standalone'

function orderPayable(order: Order) {
    return Math.max(0, (order.price ?? 0) + (order.charges ?? 0) - (order.discount ?? 0))
}

function orderOutstanding(order: Order) {
    return Math.max(0, orderPayable(order) - (order.payment ?? 0))
}

function orderRefundable(order: Order) {
    return Math.max(0, (order.payment ?? 0) - (order.refunded ?? 0))
}

function formatPkr(amount: number) {
    return `PKR ${Number(amount || 0).toLocaleString()}`
}

export type CustomerAnalyticsTxnContext = {
    customerId?: string | null
    orderId?: string | null
    direction?: KhataDirection
}

export function CustomerAnalyticsTransactionDialog({
    open,
    onOpenChange,
    context,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    context: CustomerAnalyticsTxnContext | null
    onSuccess: () => void
}) {
    const { data: customersData } = useGetCustomersQuery(undefined, { skip: !open })
    const { data: ordersData } = useGetOrdersQuery(undefined, { skip: !open })
    const [createKhata, { isLoading: savingKhata }] = useCreateCustomerKhataMutation()
    const [addPayment, { isLoading: savingPayment }] = useAddOrderPaymentMutation()
    const [recordRefund, { isLoading: savingRefund }] = useRecordOrderRefundMutation()
    const proof = usePaymentProofFields(open)

    const [customerId, setCustomerId] = useState('')
    const [orderId, setOrderId] = useState(STANDALONE)
    const [direction, setDirection] = useState<KhataDirection>('in')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    const customers = customersData?.customers ?? []
    const orders = ordersData?.orders ?? []
    const customerLocked = Boolean(context?.customerId)
    const orderLocked = Boolean(context?.orderId)
    const directionLocked = Boolean(context?.direction)

    useEffect(() => {
        if (!open) return
        setCustomerId(context?.customerId ?? '')
        setOrderId(context?.orderId ?? STANDALONE)
        setDirection(context?.direction ?? 'in')
        setAmount('')
        setDescription('')
    }, [open, context])

    const customerOrders = useMemo(
        () => orders.filter((order) => order.customerId === customerId && ['saved', 'cancelled', 'returned'].includes(order.status ?? '')),
        [orders, customerId]
    )

    const selectedCustomer = customers.find((customer) => (customer.id ?? customer._id) === customerId)
    const selectedOrder = customerOrders.find((order) => (order.id ?? order._id) === orderId) ?? null
    const linked = orderId !== STANDALONE

    const limit = linked
        ? selectedOrder
            ? direction === 'in'
                ? orderOutstanding(selectedOrder)
                : orderRefundable(selectedOrder)
            : null
        : direction === 'in'
          ? (selectedCustomer?.owed ?? 0)
          : null

    const help = linked
        ? direction === 'in'
            ? `Records an order payment. Outstanding on this order: ${formatPkr(limit ?? 0)}.`
            : `Records an order refund. Refundable on this order: ${formatPkr(limit ?? 0)}.`
        : direction === 'in'
          ? 'Standalone In — reduces outstanding. Cannot exceed current balance owed.'
          : 'Standalone Out — increases outstanding.'

    const isLoading = savingKhata || savingPayment || savingRefund
    const title = linked
        ? direction === 'in'
            ? 'Order payment'
            : 'Order refund'
        : direction === 'in'
          ? 'Standalone transaction In'
          : 'Standalone transaction Out'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const parsedAmount = Number(amount)
        if (!customerId) {
            toast.error('Select a customer')
            return
        }
        if (!parsedAmount || parsedAmount <= 0) {
            toast.error('Enter a valid amount')
            return
        }
        if (limit != null && parsedAmount > limit) {
            toast.error(`Amount cannot exceed ${formatPkr(limit)}`)
            return
        }
        const linkedOrderId = selectedOrder ? (selectedOrder.id ?? selectedOrder._id) : linked ? orderId : ''
        if (linked && !linkedOrderId) {
            toast.error('Select a valid order to link this transaction')
            return
        }

        try {
            if (linked && linkedOrderId) {
                const id = linkedOrderId
                if (direction === 'in') {
                    await addPayment({
                        id,
                        payment: parsedAmount,
                        paymentMode: proof.paymentMode,
                        proofImage: proof.proofImage
                    }).unwrap()
                    toast.success('Order payment recorded')
                } else {
                    await recordRefund({
                        id,
                        refundAmount: parsedAmount,
                        notes: description.trim() || undefined,
                        paymentMode: proof.paymentMode,
                        proofImage: proof.proofImage
                    }).unwrap()
                    toast.success('Order refund recorded')
                }
            } else {
                await createKhata({
                    partyId: customerId,
                    direction,
                    amount: parsedAmount,
                    description: description.trim() || undefined,
                    paymentMode: proof.paymentMode,
                    proofImage: proof.proofImage
                }).unwrap()
                toast.success('Standalone transaction recorded')
            }
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not record transaction'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <p className="text-muted-foreground text-sm">{help}</p>

                    <div className="space-y-2">
                        <Label>Customer</Label>
                        <Select
                            value={customerId}
                            onValueChange={(value) => {
                                setCustomerId(value)
                                if (!orderLocked) setOrderId(STANDALONE)
                            }}
                            disabled={customerLocked}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map((customer) => {
                                    const id = customer.id ?? customer._id
                                    return (
                                        <SelectItem
                                            key={id}
                                            value={id}>
                                            {customer.name} (owed {formatPkr(customer.owed ?? 0)})
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Direction</Label>
                        <Select
                            value={direction}
                            onValueChange={(value) => setDirection(value as KhataDirection)}
                            disabled={directionLocked}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="in">In (received)</SelectItem>
                                <SelectItem value="out">Out (paid)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Link to order</Label>
                        <Select
                            value={orderId}
                            onValueChange={setOrderId}
                            disabled={orderLocked || !customerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Standalone (not linked)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={STANDALONE}>Standalone (not linked)</SelectItem>
                                {customerOrders.map((order) => {
                                    const id = order.id ?? order._id
                                    return (
                                        <SelectItem
                                            key={id}
                                            value={id}>
                                            #{order.orderNumber ?? id.slice(0, 8)} · {order.status ?? 'saved'} ·{' '}
                                            {direction === 'in'
                                                ? `due ${formatPkr(orderOutstanding(order))}`
                                                : `refundable ${formatPkr(orderRefundable(order))}`}
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="analytics-txn-amount">Amount (PKR)</Label>
                        <Input
                            id="analytics-txn-amount"
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                        {limit != null ? <p className="text-muted-foreground text-xs">Maximum: {formatPkr(limit)}</p> : null}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="analytics-txn-note">Note (optional)</Label>
                        <Textarea
                            id="analytics-txn-note"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Optional note for this entry"
                        />
                    </div>

                    <PaymentProofFields
                        paymentMode={proof.paymentMode}
                        onPaymentModeChange={proof.setPaymentMode}
                        proofImage={proof.proofImage}
                        onProofImageChange={proof.setProofImage}
                    />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || (linked && !orderLocked && !selectedOrder)}>
                            {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
