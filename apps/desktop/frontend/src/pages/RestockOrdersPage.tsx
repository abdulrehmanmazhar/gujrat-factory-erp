import { useMemo, useState } from 'react'
import { CreateRestockOrderDialog } from '@/components/suppliers/CreateRestockOrderDialog'
import {
    CancelRestockOrderDialog,
    hasReturnableItems,
    MarkRestockOrderedButton,
    RestockOrderDetailDialog,
    RestockPaymentDialog,
    RestockReceiveDialog,
    RestockRefundDialog,
    restockOutstanding,
    statusVariant
} from '@/components/suppliers/RestockOrderDialogs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePermissions } from '@/hooks/usePermissions'
import { getApiErrorMessage } from '@/lib/errors'
import { useDeleteRestockOrderMutation, useGetRestockOrdersQuery } from '@/redux/api/restockApi'
import type { RestockOrder } from '@/types/api'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'received', label: 'Received' },
    { value: 'cancelled', label: 'Cancelled' }
]

export default function RestockOrdersPage() {
    const { canWrite, canDelete } = usePermissions()
    const [statusFilter, setStatusFilter] = useState('all')
    const { data, isLoading } = useGetRestockOrdersQuery(statusFilter === 'all' ? undefined : statusFilter)
    const [deleteRestockOrder, { isLoading: deleting }] = useDeleteRestockOrderMutation()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailOrder, setDetailOrder] = useState<RestockOrder | null>(null)
    const [paymentOrder, setPaymentOrder] = useState<RestockOrder | null>(null)
    const [refundOrder, setRefundOrder] = useState<RestockOrder | null>(null)
    const [receiveOrder, setReceiveOrder] = useState<RestockOrder | null>(null)
    const [cancelOrder, setCancelOrder] = useState<RestockOrder | null>(null)
    const [deleteOrderTarget, setDeleteOrderTarget] = useState<RestockOrder | null>(null)
    const perPage = 10

    const filtered = useMemo(() => {
        const list = data?.orders ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter(
            (o) =>
                (o.referenceNumber ?? '').toLowerCase().includes(q) ||
                o.supplier?.name?.toLowerCase().includes(q) ||
                String(o.totalAmount).includes(q)
        )
    }, [data, search])

    const rows = paginate(filtered, page, perPage)

    const handleDeleteRestockOrder = async () => {
        if (!deleteOrderTarget) return
        try {
            await deleteRestockOrder(deleteOrderTarget.id ?? deleteOrderTarget._id).unwrap()
            toast.success('Restock order deleted permanently')
            setDeleteOrderTarget(null)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to delete restock order'))
        }
    }

    return (
        <div>
            <PageHeader
                title="Restock orders"
                description="Manage supplier purchase orders, payments, and returns"
                actions={
                    canWrite ? (
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="size-4" /> New order
                        </Button>
                    ) : null
                }
            />

            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search by reference or supplier..."
                        className="max-w-sm"
                    />
                    <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                                <SelectItem
                                    key={opt.value}
                                    value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <PaginationControls
                    page={page}
                    totalPages={totalPages(filtered.length, perPage)}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                />
            </div>

            <DataTable
                loading={isLoading}
                columns={[
                    {
                        key: 'referenceNumber',
                        label: 'Reference',
                        render: (row) => (row.referenceNumber as string) || '—'
                    },
                    {
                        key: 'supplier',
                        label: 'Supplier',
                        render: (row) => (row.supplier as { name?: string })?.name ?? '—'
                    },
                    {
                        key: 'totalAmount',
                        label: 'Total',
                        render: (row) => Number((row as unknown as RestockOrder).totalAmount ?? 0).toFixed(0)
                    },
                    {
                        key: 'amountPaid',
                        label: 'Paid',
                        render: (row) => String((row as unknown as RestockOrder).amountPaid ?? 0)
                    },
                    {
                        key: 'amountRefunded',
                        label: 'Refunded',
                        render: (row) => String((row as unknown as RestockOrder).amountRefunded ?? 0)
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row) => <Badge variant={statusVariant((row as unknown as RestockOrder).status)}>{String(row.status)}</Badge>
                    },
                    {
                        key: 'createdAt',
                        label: 'Created',
                        render: (row) => (row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString() : '—')
                    }
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
                renderActions={(row) => {
                    const order = row as unknown as RestockOrder
                    const isDraft = order.status === 'draft'
                    const isOrdered = order.status === 'ordered'
                    const isReceived = order.status === 'received'
                    const isCancelled = order.status === 'cancelled'
                    const outstanding = restockOutstanding(order)
                    const canReceive = (isDraft || isOrdered) && canWrite
                    const canPay = isReceived && !isCancelled && outstanding > 0 && canWrite
                    const canRefund = isReceived && !isCancelled && hasReturnableItems(order) && canWrite
                    const canCancel = isDraft && canWrite
                    const canPlace = isDraft && canWrite

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
                                    {canPlace ? <MarkRestockOrderedButton order={order} /> : null}
                                    {canReceive ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setReceiveOrder(order)}>
                                            Receive
                                        </Button>
                                    ) : null}
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

            <CreateRestockOrderDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSuccess={() => setCreateOpen(false)}
            />

            <RestockOrderDetailDialog
                open={!!detailOrder}
                onOpenChange={() => setDetailOrder(null)}
                order={detailOrder}
            />
            <RestockPaymentDialog
                open={!!paymentOrder}
                onOpenChange={() => setPaymentOrder(null)}
                order={paymentOrder}
                onSuccess={() => setPaymentOrder(null)}
            />
            <RestockRefundDialog
                open={!!refundOrder}
                onOpenChange={() => setRefundOrder(null)}
                order={refundOrder}
                onSuccess={() => setRefundOrder(null)}
            />
            <RestockReceiveDialog
                open={!!receiveOrder}
                onOpenChange={() => setReceiveOrder(null)}
                order={receiveOrder}
                onSuccess={() => setReceiveOrder(null)}
            />
            <CancelRestockOrderDialog
                open={!!cancelOrder}
                onOpenChange={() => setCancelOrder(null)}
                order={cancelOrder}
                onSuccess={() => setCancelOrder(null)}
            />
            <ConfirmDialog
                open={!!deleteOrderTarget}
                onOpenChange={() => setDeleteOrderTarget(null)}
                title="Delete restock order permanently?"
                description="This removes the restock order record only. Product stock and supplier transactions will not be changed."
                onConfirm={handleDeleteRestockOrder}
                loading={deleting}
            />
        </div>
    )
}
