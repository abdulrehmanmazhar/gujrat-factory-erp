import { useMemo, useState } from 'react'
import { CancelOrderDialog, OrderDetailDialog, PaymentDialog, RefundOrderDialog, ReturnOrderDialog } from '@/components/orders/OrderDetailDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/download'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'
import { useGenerateInvoicesMutation, useGenerateOrderSheetMutation, useDeleteOrderMutation, useGetOrdersQuery } from '@/redux/api/ordersApi'
import type { Order } from '@/types/api'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

function orderPayable(order: Order) {
    return Math.max(0, (order.price ?? 0) + (order.charges ?? 0) - (order.discount ?? 0))
}

function orderOutstanding(order: Order) {
    return Math.max(0, orderPayable(order) - (order.payment ?? 0))
}

function orderRefundable(order: Order) {
    return Math.max(0, (order.payment ?? 0) - (order.refunded ?? 0))
}

function orderStatusLabel(order: Order) {
    if (order.status === 'cancelled') return 'Cancelled'
    if (order.returnedAt || order.status === 'returned') return 'Returned'
    return 'Active'
}

function orderStatusVariant(order: Order): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (order.status === 'cancelled') return 'destructive'
    if (order.returnedAt || order.status === 'returned') return 'secondary'
    return 'outline'
}

export default function OrdersPage() {
    const { canWrite, canDelete } = usePermissions()
    const { data, isLoading } = useGetOrdersQuery()
    const [generateInvoices, { isLoading: generating }] = useGenerateInvoicesMutation()
    const [generateOrderSheet, { isLoading: generatingSheet }] = useGenerateOrderSheetMutation()
    const [deleteOrder, { isLoading: deleting }] = useDeleteOrderMutation()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [detailOrder, setDetailOrder] = useState<Order | null>(null)
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
    const [refundOrder, setRefundOrder] = useState<Order | null>(null)
    const [returnOrder, setReturnOrder] = useState<Order | null>(null)
    const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
    const [deleteOrderTarget, setDeleteOrderTarget] = useState<Order | null>(null)
    const perPage = 10

    const filtered = useMemo(() => {
        const list = data?.orders ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter(
            (o) =>
                String(o.orderNumber ?? '').includes(q) ||
                o.customerDetails?.name?.toLowerCase().includes(q) ||
                o.userDetails?.name?.toLowerCase().includes(q)
        )
    }, [data, search])

    const rows = paginate(filtered, page, perPage)

    const toggleRow = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAllOnPage = () => {
        const pageIds = rows.map((r) => r.id ?? r._id)
        setSelectedIds((prev) => {
            const allSelected = pageIds.every((id) => prev.has(id))
            const next = new Set(prev)
            if (allSelected) pageIds.forEach((id) => next.delete(id))
            else pageIds.forEach((id) => next.add(id))
            return next
        })
    }

    const handleGenerateOrderSheet = async () => {
        if (selectedIds.size === 0) {
            toast.error('Select at least one order')
            return
        }
        try {
            const blob = await generateOrderSheet({ orderIds: [...selectedIds] }).unwrap()
            downloadBlob(blob, `Order-sheet-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`)
            toast.success('Order sheet downloaded')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to generate order sheet'))
        }
    }

    const handleGenerateInvoices = async () => {
        if (selectedIds.size === 0) {
            toast.error('Select at least one order')
            return
        }
        try {
            const blob = await generateInvoices({ orderIds: [...selectedIds] }).unwrap()
            downloadBlob(blob, `Orders-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`)
            toast.success('Invoices downloaded')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to generate invoices'))
        }
    }

    const handleDeleteOrder = async () => {
        if (!deleteOrderTarget) return
        try {
            await deleteOrder(deleteOrderTarget.id ?? deleteOrderTarget._id).unwrap()
            toast.success('Order deleted permanently')
            setDeleteOrderTarget(null)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to delete order'))
        }
    }

    return (
        <div>
            <PageHeader
                title="Orders"
                description="View and manage customer orders, payments, and refunds"
                actions={
                    canWrite ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => void handleGenerateOrderSheet()}
                                disabled={generatingSheet || selectedIds.size === 0}>
                                <FileSpreadsheet className="size-4" />
                                {generatingSheet ? 'Generating...' : `Generate order sheet (${selectedIds.size})`}
                            </Button>
                            <Button
                                onClick={() => void handleGenerateInvoices()}
                                disabled={generating || selectedIds.size === 0}>
                                <FileDown className="size-4" />
                                {generating ? 'Generating...' : `Generate invoices (${selectedIds.size})`}
                            </Button>
                        </>
                    ) : undefined
                }
            />

            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search orders..."
                />
                <PaginationControls
                    page={page}
                    totalPages={totalPages(filtered.length, perPage)}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                />
            </div>

            <DataTable
                loading={isLoading}
                selectable={canWrite}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAllOnPage}
                columns={[
                    { key: 'orderNumber', label: 'Order #' },
                    {
                        key: 'customerDetails',
                        label: 'Customer',
                        render: (row) => (row.customerDetails as { name?: string })?.name ?? '—'
                    },
                    { key: 'price', label: 'Total' },
                    { key: 'payment', label: 'Paid' },
                    {
                        key: 'refunded',
                        label: 'Refunded',
                        render: (row) => String((row as unknown as Order).refunded ?? 0)
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row) => {
                            const order = row as unknown as Order
                            return <Badge variant={orderStatusVariant(order)}>{orderStatusLabel(order)}</Badge>
                        }
                    },
                    {
                        key: 'orderMode',
                        label: 'Mode',
                        render: (row) => ((row as unknown as Order).orderMode === 'pos' ? 'POS' : 'Delayed')
                    },
                    {
                        key: 'deliveryStatus',
                        label: 'Delivered',
                        render: (row) => (row.deliveryStatus ? 'Yes' : 'No')
                    }
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
                renderActions={(row) => {
                    const order = row as unknown as Order
                    const isCancelled = order.status === 'cancelled'
                    const isReturned = !!order.returnedAt || order.status === 'returned'
                    const outstanding = orderOutstanding(order)
                    const refundable = orderRefundable(order)
                    const canPay = canWrite && !isCancelled && !isReturned && outstanding > 0
                    const canRefund = canWrite && !isCancelled && refundable > 0
                    const canReturn = canWrite && !!order.deliveryStatus && !isReturned && !isCancelled
                    const canCancel = canWrite && !order.deliveryStatus && !isReturned && !isCancelled

                    return (
                        <RowActions
                            extra={
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDetailOrder(order)}>
                                        View
                                    </Button>
                                    {canPay ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPaymentOrder(order)}>
                                            Pay
                                        </Button>
                                    ) : null}
                                    {canRefund ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setRefundOrder(order)}>
                                            Refund
                                        </Button>
                                    ) : null}
                                    {canReturn ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setReturnOrder(order)}>
                                            Return
                                        </Button>
                                    ) : null}
                                    {canDelete ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => setDeleteOrderTarget(order)}>
                                            Delete
                                        </Button>
                                    ) : null}
                                </>
                            }
                            deleteLabel="Cancel"
                            onDelete={canCancel ? () => setCancelOrder(order) : undefined}
                        />
                    )
                }}
            />

            <OrderDetailDialog
                open={!!detailOrder}
                onOpenChange={() => setDetailOrder(null)}
                order={detailOrder}
            />
            <PaymentDialog
                open={!!paymentOrder}
                onOpenChange={() => setPaymentOrder(null)}
                order={paymentOrder}
                onSuccess={() => setPaymentOrder(null)}
            />
            <RefundOrderDialog
                open={!!refundOrder}
                onOpenChange={() => setRefundOrder(null)}
                order={refundOrder}
                onSuccess={() => setRefundOrder(null)}
            />
            <ReturnOrderDialog
                open={!!returnOrder}
                onOpenChange={() => setReturnOrder(null)}
                order={returnOrder}
                onSuccess={() => setReturnOrder(null)}
            />
            <CancelOrderDialog
                open={!!cancelOrder}
                onOpenChange={() => setCancelOrder(null)}
                order={cancelOrder}
                onSuccess={() => setCancelOrder(null)}
            />
            <ConfirmDialog
                open={!!deleteOrderTarget}
                onOpenChange={() => setDeleteOrderTarget(null)}
                title="Delete order permanently?"
                description="This removes the order record only. Stock levels and existing transactions will not be changed."
                onConfirm={handleDeleteOrder}
                loading={deleting}
            />
        </div>
    )
}
