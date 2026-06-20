import { useMemo, useState } from 'react'
import { PaymentDialog } from '@/components/orders/OrderDetailDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { useGetOrdersQuery } from '@/redux/api/ordersApi'
import type { Order } from '@/types/api'

export default function PaymentsPage() {
    const { data, isLoading } = useGetOrdersQuery()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
    const perPage = 10

    const outstanding = useMemo(() => {
        return (data?.orders ?? []).filter((o) => (o.payment ?? 0) < (o.price ?? 0))
    }, [data])

    const filtered = useMemo(() => {
        if (!search.trim()) return outstanding
        const q = search.toLowerCase()
        return outstanding.filter((o) => o.customerDetails?.name?.toLowerCase().includes(q))
    }, [outstanding, search])

    const rows = paginate(filtered, page, perPage).map((o) => ({
        ...o,
        outstanding: (o.price ?? 0) - (o.payment ?? 0)
    }))

    return (
        <div>
            <PageHeader
                title="Payments"
                description="Outstanding order balances and udhar payments"
            />

            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by customer..."
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
                columns={[
                    { key: 'orderNumber', label: 'Order #' },
                    {
                        key: 'customerDetails',
                        label: 'Customer',
                        render: (row) => (row.customerDetails as { name?: string })?.name ?? '—'
                    },
                    { key: 'price', label: 'Total' },
                    { key: 'payment', label: 'Paid' },
                    { key: 'outstanding', label: 'Outstanding' }
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
                renderActions={(row) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPaymentOrder(row as unknown as Order)}>
                        Collect
                    </Button>
                )}
            />

            <PaymentDialog
                open={!!paymentOrder}
                onOpenChange={() => setPaymentOrder(null)}
                order={paymentOrder}
                mode="udhar"
                onSuccess={() => setPaymentOrder(null)}
            />
        </div>
    )
}
