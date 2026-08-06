import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaymentProofFields, usePaymentProofFields } from '@/components/shared/PaymentProofFields'
import { getApiErrorMessage } from '@/lib/errors'
import {
    useCancelRestockOrderMutation,
    useMarkRestockOrderedMutation,
    useReceiveRestockOrderMutation,
    useRecordRestockPaymentMutation,
    useRecordRestockRefundMutation
} from '@/redux/api/restockApi'
import type { RestockOrder, RestockOrderItem } from '@/types/api'
import { toast } from 'sonner'

export function restockOutstanding(order: RestockOrder) {
    return Math.max(0, (order.totalAmount ?? 0) - (order.amountPaid ?? 0))
}

export function restockRefundable(order: RestockOrder) {
    return Math.max(0, (order.amountPaid ?? 0) - (order.amountRefunded ?? 0))
}

export function itemReturnable(item: RestockOrderItem) {
    return Math.max(0, (item.qtyReceived ?? 0) - (item.qtyReturned ?? 0))
}

export function hasReturnableItems(order: RestockOrder) {
    return (order.items ?? []).some((item) => itemReturnable(item) > 0)
}

export function estimateMaxCashRefund(order: RestockOrder, returnValue: number) {
    const paid = order.amountPaid ?? 0
    const refunded = order.amountRefunded ?? 0
    const newTotal = Math.max(0, (order.totalAmount ?? 0) - returnValue)
    return Math.min(returnValue, Math.max(0, paid - refunded - newTotal))
}

export function statusVariant(status: RestockOrder['status']) {
    if (status === 'received') return 'default'
    if (status === 'cancelled') return 'destructive'
    if (status === 'ordered') return 'secondary'
    return 'outline'
}

export function RestockOrderDetailDialog({
    open,
    onOpenChange,
    order
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: RestockOrder | null
}) {
    if (!order) return null

    const outstanding = restockOutstanding(order)
    const refundable = restockRefundable(order)

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Restock order
                        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <p>
                            <span className="text-muted-foreground">Supplier:</span> {order.supplier?.name ?? '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Reference:</span> {order.referenceNumber ?? '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Total:</span> {order.totalAmount?.toFixed(0) ?? 0}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Paid:</span> {(order.amountPaid ?? 0).toFixed(0)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Refunded:</span> {(order.amountRefunded ?? 0).toFixed(0)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Outstanding:</span> {outstanding.toFixed(0)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Refundable:</span> {refundable.toFixed(0)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Created:</span>{' '}
                            {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                        </p>
                    </div>
                    {order.notes ? (
                        <p>
                            <span className="text-muted-foreground">Notes:</span> {order.notes}
                        </p>
                    ) : null}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Ordered</TableHead>
                                <TableHead>Received</TableHead>
                                <TableHead>Returned</TableHead>
                                <TableHead>Unit cost</TableHead>
                                <TableHead>Line total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(order.items ?? []).map((item) => {
                                const itemId = item.id ?? item._id
                                return (
                                    <TableRow key={itemId}>
                                        <TableCell>{item.product?.name ?? item.productId}</TableCell>
                                        <TableCell>{item.qtyOrdered}</TableCell>
                                        <TableCell>{item.qtyReceived ?? 0}</TableCell>
                                        <TableCell>{item.qtyReturned ?? 0}</TableCell>
                                        <TableCell>{item.unitCost}</TableCell>
                                        <TableCell>{item.lineTotal}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function RestockPaymentDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: RestockOrder | null
    onSuccess: () => void
}) {
    const [amount, setAmount] = useState('')
    const [notes, setNotes] = useState('')
    const [recordPayment, { isLoading }] = useRecordRestockPaymentMutation()
    const { paymentMode, setPaymentMode, proofImage, setProofImage } = usePaymentProofFields(open)

    useEffect(() => {
        setAmount('')
        setNotes('')
    }, [open, order])

    if (!order) return null

    const outstanding = restockOutstanding(order)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const value = Number(amount)
        if (value <= 0) {
            toast.error('Enter a positive payment amount')
            return
        }
        if (value > outstanding) {
            toast.error(`Payment cannot exceed outstanding amount (${outstanding})`)
            return
        }
        try {
            await recordPayment({
                id: order.id ?? order._id,
                amount: value,
                notes: notes.trim() || undefined,
                paymentMode,
                proofImage
            }).unwrap()
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
                    <DialogTitle>Pay supplier</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Record money paid to the supplier for this received order. Outstanding: {outstanding.toFixed(0)}
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor="restock-payment-amount">Amount</Label>
                        <Input
                            id="restock-payment-amount"
                            type="number"
                            min={0}
                            max={outstanding}
                            step="any"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="restock-payment-notes">Notes (optional)</Label>
                        <Input
                            id="restock-payment-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
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
                        disabled={isLoading}>
                        Record payment
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function RestockRefundDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: RestockOrder | null
    onSuccess: () => void
}) {
    const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({})
    const [cashRefund, setCashRefund] = useState('')
    const [notes, setNotes] = useState('')
    const [recordRefund, { isLoading }] = useRecordRestockRefundMutation()
    const { paymentMode, setPaymentMode, proofImage, setProofImage } = usePaymentProofFields(open)

    useEffect(() => {
        setNotes('')
        setCashRefund('')
        const initial: Record<string, string> = {}
        for (const item of order?.items ?? []) {
            initial[item.id ?? item._id] = '0'
        }
        setQtyByItem(initial)
    }, [open, order])

    const returnTotal = useMemo(() => {
        if (!order) return 0
        return (order.items ?? []).reduce((sum, item) => {
            const id = item.id ?? item._id
            const qty = Number(qtyByItem[id] ?? 0)
            if (!qty || qty <= 0) return sum
            return sum + qty * item.unitCost
        }, 0)
    }, [order, qtyByItem])

    const maxCashRefund = order ? estimateMaxCashRefund(order, returnTotal) : 0
    const cashAmountValue = cashRefund === '' ? 0 : Number(cashRefund)
    const showProof = maxCashRefund > 0 && cashAmountValue > 0

    useEffect(() => {
        if (!open) return
        setCashRefund(maxCashRefund > 0 ? String(maxCashRefund) : '')
    }, [open, maxCashRefund])

    if (!order) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (returnTotal <= 0) {
            toast.error('Enter quantities to return to the supplier')
            return
        }

        const returnedItems = (order.items ?? [])
            .map((item) => {
                const id = item.id ?? item._id
                const qtyReturned = Number(qtyByItem[id] ?? 0)
                return { itemId: id, qtyReturned }
            })
            .filter((item) => item.qtyReturned > 0)

        for (const item of order.items ?? []) {
            const id = item.id ?? item._id
            const qty = Number(qtyByItem[id] ?? 0)
            if (qty > itemReturnable(item)) {
                toast.error(`Cannot return more than ${itemReturnable(item)} for ${item.product?.name ?? 'item'}`)
                return
            }
        }

        const cashAmount = cashRefund === '' ? undefined : Number(cashRefund)
        if (cashAmount !== undefined && (Number.isNaN(cashAmount) || cashAmount < 0)) {
            toast.error('Enter a valid cash refund amount')
            return
        }
        if (cashAmount !== undefined && cashAmount > maxCashRefund) {
            toast.error(`Cash refund cannot exceed ${maxCashRefund}`)
            return
        }

        try {
            await recordRefund({
                id: order.id ?? order._id,
                returnedItems,
                amount: cashAmount,
                notes: notes.trim() || undefined,
                paymentMode,
                proofImage: cashAmount && cashAmount > 0 ? proofImage : null
            }).unwrap()
            toast.success(maxCashRefund > 0 ? 'Stock returned and supplier refund recorded' : 'Stock returned — order balance reduced')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Refund failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Return stock to supplier</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Returning stock removes it from inventory and lowers what you still owe on this order. If you have already overpaid the
                        supplier, enter the cash amount they are paying back.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Paid: {(order.amountPaid ?? 0).toFixed(0)} · Refunded: {(order.amountRefunded ?? 0).toFixed(0)} · Order total:{' '}
                        {(order.totalAmount ?? 0).toFixed(0)}
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Received</TableHead>
                                <TableHead>Already returned</TableHead>
                                <TableHead>Return qty</TableHead>
                                <TableHead>Unit cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(order.items ?? []).map((item) => {
                                const itemId = item.id ?? item._id
                                const returnable = itemReturnable(item)
                                return (
                                    <TableRow key={itemId}>
                                        <TableCell>{item.product?.name ?? item.productId}</TableCell>
                                        <TableCell>{item.qtyReceived ?? 0}</TableCell>
                                        <TableCell>{item.qtyReturned ?? 0}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={returnable}
                                                className="w-20"
                                                value={qtyByItem[itemId] ?? '0'}
                                                disabled={returnable <= 0}
                                                onChange={(e) => setQtyByItem((prev) => ({ ...prev, [itemId]: e.target.value }))}
                                            />
                                        </TableCell>
                                        <TableCell>{item.unitCost}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    <p className="text-sm font-medium">Stock return value: {returnTotal.toFixed(0)}</p>
                    <p className="text-sm text-muted-foreground">
                        New order total after return: {Math.max(0, (order.totalAmount ?? 0) - returnTotal).toFixed(0)}
                    </p>
                    {maxCashRefund > 0 ? (
                        <div className="space-y-2">
                            <Label htmlFor="restock-cash-refund">Cash refund from supplier (max {maxCashRefund.toFixed(0)})</Label>
                            <Input
                                id="restock-cash-refund"
                                type="number"
                                min={0}
                                max={maxCashRefund}
                                step="any"
                                value={cashRefund}
                                onChange={(e) => setCashRefund(e.target.value)}
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No cash refund needed — the returned stock value reduces your outstanding balance.
                        </p>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="restock-refund-notes">Notes (optional)</Label>
                        <Input
                            id="restock-refund-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
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
                        disabled={isLoading || returnTotal <= 0}>
                        Confirm return
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function RestockReceiveDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: RestockOrder | null
    onSuccess: () => void
}) {
    const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({})
    const [receiveOrder, { isLoading }] = useReceiveRestockOrderMutation()

    useEffect(() => {
        const initial: Record<string, string> = {}
        for (const item of order?.items ?? []) {
            initial[item.id ?? item._id] = String(item.qtyOrdered)
        }
        setQtyByItem(initial)
    }, [open, order])

    if (!order) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const receivedItems = (order.items ?? []).map((item) => {
            const id = item.id ?? item._id
            const qty = Number(qtyByItem[id] ?? item.qtyOrdered)
            return { itemId: id, qtyReceived: qty }
        })
        try {
            await receiveOrder({ id: order.id ?? order._id, receivedItems }).unwrap()
            toast.success('Stock received and inventory updated')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to receive stock'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Receive stock — {order.referenceNumber ?? order._id.slice(0, 8)}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Ordered</TableHead>
                                <TableHead>Receive qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(order.items ?? []).map((item) => {
                                const itemId = item.id ?? item._id
                                return (
                                    <TableRow key={itemId}>
                                        <TableCell>{item.product?.name ?? item.productId}</TableCell>
                                        <TableCell>{item.qtyOrdered}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={item.qtyOrdered}
                                                className="w-20"
                                                value={qtyByItem[itemId] ?? ''}
                                                onChange={(e) => setQtyByItem((prev) => ({ ...prev, [itemId]: e.target.value }))}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    <Button
                        type="submit"
                        disabled={isLoading}>
                        Confirm receive
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function CancelRestockOrderDialog({
    open,
    onOpenChange,
    order,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: RestockOrder | null
    onSuccess: () => void
}) {
    const [cancelOrder, { isLoading }] = useCancelRestockOrderMutation()

    if (!order) return null

    const handleConfirm = async () => {
        try {
            await cancelOrder(order.id ?? order._id).unwrap()
            toast.success('Restock order cancelled')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to cancel order'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cancel restock order</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    Cancel draft order {order.referenceNumber ?? order._id.slice(0, 8)}? This cannot be undone.
                </p>
                <Button
                    variant="destructive"
                    onClick={handleConfirm}
                    disabled={isLoading}>
                    Confirm cancellation
                </Button>
            </DialogContent>
        </Dialog>
    )
}

export function MarkRestockOrderedButton({
    order,
    onSuccess,
    size = 'sm'
}: {
    order: RestockOrder
    onSuccess?: () => void
    size?: 'sm' | 'default'
}) {
    const [markOrdered, { isLoading }] = useMarkRestockOrderedMutation()

    const handleClick = async () => {
        try {
            await markOrdered(order.id ?? order._id).unwrap()
            toast.success('Order marked as placed with supplier')
            onSuccess?.()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to update order'))
        }
    }

    return (
        <Button
            variant="ghost"
            size={size}
            onClick={handleClick}
            disabled={isLoading}>
            Place
        </Button>
    )
}
