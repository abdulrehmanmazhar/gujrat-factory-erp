import { useMemo, useState } from 'react'
import { OrderDetailDialog, PaymentDialog } from '@/components/orders/OrderDetailDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/download'
import { getApiErrorMessage } from '@/lib/errors'
import { useDeleteOrderMutation, useGenerateInvoicesMutation, useGetOrdersQuery } from '@/redux/api/ordersApi'
import type { Order } from '@/types/api'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'

export default function OrdersPage() {
    const { data, isLoading, refetch } = useGetOrdersQuery()
    const [deleteOrder, { isLoading: deleting }] = useDeleteOrderMutation()
    const [generateInvoices, { isLoading: generating }] = useGenerateInvoicesMutation()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [detailOrder, setDetailOrder] = useState<Order | null>(null)
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
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
                        key: 'deliveryStatus',
                        label: 'Delivered',
                        render: (row) => (row.deliveryStatus ? 'Yes' : 'No')
                    }
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
                renderActions={(row) => (
                    <RowActions
                        extra={
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDetailOrder(row as unknown as Order)}>
                                    View
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPaymentOrder(row as unknown as Order)}>
                                    Pay
                                </Button>
                            </>
                        }
                        onDelete={() => setDeleteId(String(row.id ?? row._id))}
                    />
                )}
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
                onSuccess={() => {
                    setPaymentOrder(null)
                    refetch()
                }}
            />
            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
                title="Delete order?"
                onConfirm={async () => {
                    if (!deleteId) return
                    try {
                        await deleteOrder(deleteId).unwrap()
                        toast.success('Order deleted')
                        setDeleteId(null)
                        refetch()
                    } catch (err) {
                        toast.error(getApiErrorMessage(err, 'Delete failed'))
                    }
                }}
                loading={deleting}
            />
        </div>
    )
}
