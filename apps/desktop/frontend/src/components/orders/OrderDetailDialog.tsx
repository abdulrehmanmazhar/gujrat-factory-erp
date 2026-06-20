import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAddOrderPaymentMutation, useReturnOrderUdharMutation } from '@/redux/api/ordersApi'
import type { Order } from '@/types/api'
import { toast } from 'sonner'

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
                            <span className="text-muted-foreground">Route:</span> {order.customerDetails?.route ?? '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Total:</span> {order.price ?? 0}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Paid:</span> {order.payment ?? 0}
                        </p>
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
    onSuccess,
    mode = 'payment'
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: Order | null
    onSuccess: () => void
    mode?: 'payment' | 'udhar'
}) {
    const [payment, setPayment] = useState('')
    const [addPayment, { isLoading: paying }] = useAddOrderPaymentMutation()
    const [returnUdhar, { isLoading: returning }] = useReturnOrderUdharMutation()

    useEffect(() => {
        setPayment('')
    }, [open, order])

    if (!order) return null

    const outstanding = Math.max(0, (order.price ?? 0) - (order.payment ?? 0))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = Number(payment)
        if (amount < 0) return
        try {
            const id = order.id ?? order._id
            if (mode === 'udhar') {
                await returnUdhar({ id, payment: amount }).unwrap()
            } else {
                await addPayment({ id, payment: amount }).unwrap()
            }
            toast.success('Payment recorded')
            onSuccess()
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Payment failed')
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === 'udhar' ? 'Udhar Payment' : 'Add Payment'}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <p className="text-sm text-muted-foreground">Outstanding: {outstanding}</p>
                    <Input
                        type="number"
                        value={payment}
                        onChange={(e) => setPayment(e.target.value)}
                        required
                    />
                    <Button
                        type="submit"
                        disabled={paying || returning}>
                        Submit
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
