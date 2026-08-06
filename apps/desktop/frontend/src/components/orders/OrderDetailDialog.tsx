import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaymentProofFields, usePaymentProofFields } from '@/components/shared/PaymentProofFields'
import { useAddOrderPaymentMutation, useCancelOrderMutation, useRecordOrderRefundMutation, useReturnOrderMutation } from '@/redux/api/ordersApi'
import type { Order } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'

function orderPayable(order: Order) {
    return Math.max(0, (order.price ?? 0) - (order.discount ?? 0))
}

function orderOutstanding(order: Order) {
    return Math.max(0, orderPayable(order) - (order.payment ?? 0))
}

function orderRefundable(order: Order) {
    return Math.max(0, (order.payment ?? 0) - (order.refunded ?? 0))
}

export function OrderDetailDialog({ open, onOpenChange, order }: { open: boolean; onOpenChange: (open: boolean) => void; order: Order | null }) {
    if (!order) return null

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Order #{order.orderNumber ?? order._id.slice(0, 8)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <p>
                            <span className="text-muted-foreground">Customer:</span> {order.customerDetails?.name}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Total:</span> {orderPayable(order)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Paid:</span> {order.payment ?? 0}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Refunded:</span> {order.refunded ?? 0}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Outstanding:</span> {orderOutstanding(order)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Refundable:</span> {orderRefundable(order)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Mode:</span> {order.orderMode === 'pos' ? 'POS' : 'Delayed'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Delivered:</span> {order.deliveryStatus ? 'Yes' : 'No'}
                        </p>
                        {order.returnedAt ? (
                            <p>
                                <span className="text-muted-foreground">Returned:</span> Yes
                            </p>
                        ) : null}
                        {order.status === 'cancelled' ? (
                            <p>
                                <span className="text-muted-foreground">Status:</span> Cancelled
                            </p>
                        ) : null}
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(order.cart ?? []).map((item, i) => (
                                <TableRow key={i}>
                                    <TableCell>{item.product?.name}</TableCell>
                                    <TableCell>{item.qty}</TableCell>
                                    <TableCell>{item.product?.price}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function PaymentDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: Order | null
    onSuccess: () => void
}) {
    const [payment, setPayment] = useState('')
    const [addPayment, { isLoading: paying }] = useAddOrderPaymentMutation()
    const { paymentMode, setPaymentMode, proofImage, setProofImage } = usePaymentProofFields(open)

    useEffect(() => {
        setPayment('')
    }, [open, order])

    if (!order) return null

    const outstanding = orderOutstanding(order)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = Number(payment)
        if (amount <= 0) {
            toast.error('Enter a positive payment amount')
            return
        }
        if (amount > outstanding) {
            toast.error(`Payment cannot exceed outstanding amount (${outstanding})`)
            return
        }
        try {
            const id = order.id ?? order._id
            await addPayment({ id, payment: amount, paymentMode, proofImage }).unwrap()
            toast.success('Payment recorded')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Payment failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add payment</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <p className="text-sm text-muted-foreground">Outstanding: {outstanding}</p>
                    <div className="space-y-2">
                        <Label htmlFor="payment-amount">Amount</Label>
                        <Input
                            id="payment-amount"
                            type="number"
                            min={0}
                            max={outstanding}
                            step="any"
                            value={payment}
                            onChange={(e) => setPayment(e.target.value)}
                            required
                        />
                    </div>
                    <PaymentProofFields
                        paymentMode={paymentMode}
                        onPaymentModeChange={setPaymentMode}
                        proofImage={proofImage}
                        onProofImageChange={setProofImage}
                    />
                    <Button
                        type="submit"
                        disabled={paying}>
                        Submit
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function RefundOrderDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: Order | null
    onSuccess: () => void
}) {
    const [refundAmount, setRefundAmount] = useState('')
    const [notes, setNotes] = useState('')
    const [recordRefund, { isLoading }] = useRecordOrderRefundMutation()
    const { paymentMode, setPaymentMode, proofImage, setProofImage } = usePaymentProofFields(open)

    useEffect(() => {
        setRefundAmount('')
        setNotes('')
    }, [open, order])

    if (!order) return null

    const refundable = orderRefundable(order)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = Number(refundAmount)
        if (amount <= 0) {
            toast.error('Enter a positive refund amount')
            return
        }
        if (amount > refundable) {
            toast.error(`Refund cannot exceed refundable amount (${refundable})`)
            return
        }
        try {
            await recordRefund({
                id: order.id ?? order._id,
                refundAmount: amount,
                notes: notes.trim() || undefined,
                paymentMode,
                proofImage
            }).unwrap()
            toast.success('Refund recorded')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Refund failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record refund — order #{order.orderNumber ?? order._id.slice(0, 8)}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Paid: {order.payment ?? 0} · Already refunded: {order.refunded ?? 0} · Refundable: {refundable}
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor="refund-installment-amount">Refund amount</Label>
                        <Input
                            id="refund-installment-amount"
                            type="number"
                            min={0}
                            max={refundable}
                            step="any"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="refund-notes">Notes (optional)</Label>
                        <Input
                            id="refund-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. partial refund installment"
                        />
                    </div>
                    <PaymentProofFields
                        paymentMode={paymentMode}
                        onPaymentModeChange={setPaymentMode}
                        proofImage={proofImage}
                        onProofImageChange={setProofImage}
                        modeLabel="Refund mode"
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || refundable <= 0}>
                        Record refund
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function ReturnOrderDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: Order | null
    onSuccess: () => void
}) {
    const [refundAmount, setRefundAmount] = useState('')
    const [returnOrder, { isLoading }] = useReturnOrderMutation()
    const { paymentMode, setPaymentMode, proofImage, setProofImage } = usePaymentProofFields(open)

    useEffect(() => {
        setRefundAmount('')
    }, [open, order])

    if (!order) return null

    const refundable = orderRefundable(order)
    const refundValue = refundAmount === '' ? 0 : Number(refundAmount)
    const showProof = refundValue > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = refundAmount === '' ? 0 : Number(refundAmount)
        if (Number.isNaN(amount) || amount < 0) {
            toast.error('Enter a valid refund amount')
            return
        }
        if (amount > refundable) {
            toast.error(`Refund cannot exceed refundable amount (${refundable})`)
            return
        }
        try {
            await returnOrder({
                id: order.id ?? order._id,
                refundAmount: amount,
                paymentMode,
                proofImage: amount > 0 ? proofImage : null
            }).unwrap()
            toast.success('Order returned')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Return failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Return order #{order.orderNumber ?? order._id.slice(0, 8)}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Stock will be restored. You may refund now or record refunds later in installments (max refundable: {refundable}).
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor="refund-amount">Refund amount (optional)</Label>
                        <Input
                            id="refund-amount"
                            type="number"
                            min={0}
                            max={refundable}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                    <PaymentProofFields
                        paymentMode={paymentMode}
                        onPaymentModeChange={setPaymentMode}
                        proofImage={proofImage}
                        onProofImageChange={setProofImage}
                        showWhen={showProof}
                        modeLabel="Refund mode"
                    />
                    <Button
                        type="submit"
                        disabled={isLoading}>
                        Confirm return
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function CancelOrderDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: Order | null
    onSuccess: () => void
}) {
    const [refundAmount, setRefundAmount] = useState('')
    const [cancelOrder, { isLoading }] = useCancelOrderMutation()

    useEffect(() => {
        setRefundAmount('')
    }, [open, order])

    if (!order) return null

    const refundable = orderRefundable(order)
    const hasRefundable = refundable > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = refundAmount === '' ? 0 : Number(refundAmount)
        if (Number.isNaN(amount) || amount < 0) {
            toast.error('Enter a valid refund amount')
            return
        }
        if (amount > refundable) {
            toast.error(`Refund cannot exceed refundable amount (${refundable})`)
            return
        }
        try {
            await cancelOrder({ id: order.id ?? order._id, refundAmount: amount }).unwrap()
            toast.success('Order cancelled')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Cancel failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cancel order #{order.orderNumber ?? order._id.slice(0, 8)}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        The order will be marked cancelled and will not deduct stock on its delivery date.
                        {order.stockDeducted ? ' Any stock already reserved will be restored.' : ''}
                    </p>
                    {hasRefundable ? (
                        <div className="space-y-2">
                            <Label htmlFor="cancel-refund-amount">Refund amount (max {refundable})</Label>
                            <Input
                                id="cancel-refund-amount"
                                type="number"
                                min={0}
                                max={refundable}
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(e.target.value)}
                                placeholder="0"
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter how much to refund now. Leave empty or 0 if no cash refund yet — you can refund in installments later.
                            </p>
                        </div>
                    ) : null}
                    <Button
                        type="submit"
                        variant="destructive"
                        disabled={isLoading}>
                        Confirm cancellation
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
