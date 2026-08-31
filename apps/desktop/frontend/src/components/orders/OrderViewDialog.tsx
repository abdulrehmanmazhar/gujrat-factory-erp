import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetOrderQuery } from '@/redux/api/ordersApi'

export function OrderViewDialog({ open, onOpenChange, orderId }: { open: boolean; onOpenChange: (open: boolean) => void; orderId: string | null }) {
    const { data, isLoading, isError } = useGetOrderQuery(orderId ?? '', { skip: !open || !orderId })
    const order = data?.order ?? null

    if (!open) return null

    if (isLoading || isError || !order) {
        return (
            <Dialog
                open={open}
                onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isLoading ? 'Loading order...' : 'Order'}</DialogTitle>
                    </DialogHeader>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-2/3" />
                            <Skeleton className="h-40 w-full" />
                        </div>
                    ) : (
                        <p className="text-destructive text-sm">Could not load this order.</p>
                    )}
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <OrderDetailDialog
            open={open}
            onOpenChange={onOpenChange}
            order={order}
        />
    )
}
