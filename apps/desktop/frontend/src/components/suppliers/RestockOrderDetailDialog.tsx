import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getApiErrorMessage } from '@/lib/errors'
import { useCancelRestockOrderMutation, useMarkRestockOrderedMutation, useReceiveRestockOrderMutation } from '@/redux/api/restockApi'
import type { RestockOrder } from '@/types/api'
import { toast } from 'sonner'

function statusVariant(status: RestockOrder['status']) {
    if (status === 'received') return 'default'
    if (status === 'cancelled') return 'destructive'
    if (status === 'ordered') return 'secondary'
    return 'outline'
}

export function RestockOrderDetailDialog({
    open,
    onOpenChange,
    order,
    onSuccess,
    canManage = true
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: RestockOrder | null
    onSuccess?: () => void
    canManage?: boolean
}) {
    const [markOrdered, { isLoading: ordering }] = useMarkRestockOrderedMutation()
    const [receiveOrder, { isLoading: receiving }] = useReceiveRestockOrderMutation()
    const [cancelOrder, { isLoading: cancelling }] = useCancelRestockOrderMutation()
    const [receiveMode, setReceiveMode] = useState(false)
    const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!order || !open) return
        setReceiveMode(false)
        const initial: Record<string, string> = {}
        for (const item of order.items ?? []) {
            initial[item.id ?? item._id] = String(item.qtyOrdered)
        }
        setQtyByItem(initial)
    }, [order, open])

    if (!order) return null

    const orderId = order.id ?? order._id
    const isDraft = order.status === 'draft'
    const isOrdered = order.status === 'ordered'
    const canReceive = isDraft || isOrdered
    const canCancel = isDraft

    const handleMarkOrdered = async () => {
        try {
            await markOrdered(orderId).unwrap()
            toast.success('Order marked as placed with supplier')
            onSuccess?.()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to update order'))
        }
    }

    const handleReceive = async () => {
        const receivedItems = (order.items ?? []).map((item) => {
            const id = item.id ?? item._id
            const qty = Number(qtyByItem[id] ?? item.qtyOrdered)
            return { itemId: id, qtyReceived: qty }
        })
        try {
            await receiveOrder({ id: orderId, receivedItems }).unwrap()
            toast.success('Stock received and inventory updated')
            setReceiveMode(false)
            onSuccess?.()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to receive stock'))
        }
    }

    const handleCancel = async () => {
        try {
            await cancelOrder(orderId).unwrap()
            toast.success('Restock order cancelled')
            onSuccess?.()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to cancel order'))
        }
    }

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
                                <TableHead>Unit cost</TableHead>
                                <TableHead>Line total</TableHead>
                                {receiveMode ? <TableHead>Receive qty</TableHead> : null}
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
                                        <TableCell>{item.unitCost}</TableCell>
                                        <TableCell>{item.lineTotal}</TableCell>
                                        {receiveMode ? (
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
                                        ) : null}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>

                    {canManage && (isDraft || isOrdered || canCancel) ? (
                        <div className="flex flex-wrap gap-2">
                            {isDraft ? (
                                <Button
                                    size="sm"
                                    onClick={handleMarkOrdered}
                                    disabled={ordering}>
                                    Mark as ordered
                                </Button>
                            ) : null}
                            {canReceive && !receiveMode ? (
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => setReceiveMode(true)}>
                                    Receive stock
                                </Button>
                            ) : null}
                            {receiveMode ? (
                                <>
                                    <Button
                                        size="sm"
                                        onClick={handleReceive}
                                        disabled={receiving}>
                                        Confirm receive
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setReceiveMode(false)}>
                                        Cancel
                                    </Button>
                                </>
                            ) : null}
                            {canCancel ? (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={handleCancel}
                                    disabled={cancelling}>
                                    Cancel order
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}
