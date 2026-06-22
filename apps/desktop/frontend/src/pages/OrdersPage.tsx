import { useMemo, useState } from 'react'
import { CancelOrderDialog, OrderDetailDialog, PaymentDialog, ReturnOrderDialog } from '@/components/orders/OrderDetailDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/download'
import { getApiErrorMessage } from '@/lib/errors'
import { useGenerateInvoicesMutation, useGetOrdersQuery } from '@/redux/api/ordersApi'
import type { Order } from '@/types/api'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'

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
    const { data, isLoading } = useGetOrdersQuery()
    const [generateInvoices, { isLoading: generating }] = useGenerateInvoicesMutation()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [detailOrder, setDetailOrder] = useState<Order | null>(null)
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
    const [returnOrder, setReturnOrder] = useState<Order | null>(null)
    const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
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

    return (
        <div>
            <PageHeader
                title="Orders"
                description="View and manage customer orders"
                actions={
                    <Button
                        onClick={handleGenerateInvoices}
                        disabled={generating || selectedIds.size === 0}>
                        <FileDown className="size-4" />
                        {generating ? 'Generating...' : `Generate Invoices (${selectedIds.size})`}
                    </Button>
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
                selectable
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
                    const payable = Math.max(0, (order.price ?? 0) - (order.discount ?? 0))
                    const outstanding = Math.max(0, payable - (order.payment ?? 0))
                    const canPayFirst = !isCancelled && !isReturned && (order.payment === null || order.payment === undefined)
                    const canPayUdhar = !isCancelled && !isReturned && order.payment !== null && order.payment !== undefined && outstanding > 0
                    const canReturn = !!order.deliveryStatus && !isReturned && !isCancelled
                    const canCancel = !order.deliveryStatus && !isReturned && !isCancelled

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
                                    {canPayFirst ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPaymentOrder(order)}>
                                            Pay
                                        </Button>
                                    ) : null}
                                    {canPayUdhar ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPaymentOrder(order)}>
                                            Collect
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
                mode={
                    paymentOrder &&
                    paymentOrder.payment !== null &&
                    paymentOrder.payment !== undefined &&
                    Math.max(0, (paymentOrder.price ?? 0) - (paymentOrder.discount ?? 0) - (paymentOrder.payment ?? 0)) > 0
                        ? 'udhar'
                        : 'payment'
                }
                onSuccess={() => setPaymentOrder(null)}
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
        </div>
    )
}
