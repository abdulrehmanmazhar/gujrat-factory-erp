import { useMemo, useState } from 'react'
import { CreateRestockOrderDialog } from '@/components/suppliers/CreateRestockOrderDialog'
import { RestockOrderDetailDialog } from '@/components/suppliers/RestockOrderDetailDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isAdminOrAbove } from '@/lib/roles'
import { useGetRestockOrdersQuery } from '@/redux/api/restockApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import type { RestockOrder } from '@/types/api'
import { Plus } from 'lucide-react'
import { useSelector } from 'react-redux'

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'received', label: 'Received' },
    { value: 'cancelled', label: 'Cancelled' }
]

function statusVariant(status: RestockOrder['status']) {
    if (status === 'received') return 'default'
    if (status === 'cancelled') return 'destructive'
    if (status === 'ordered') return 'secondary'
    return 'outline'
}

export default function RestockOrdersPage() {
    const user = useSelector(selectCurrentUser)
    const isAdmin = isAdminOrAbove(user?.role)
    const [statusFilter, setStatusFilter] = useState('all')
    const { data, isLoading } = useGetRestockOrdersQuery(statusFilter === 'all' ? undefined : statusFilter)
    const [search, setSearch] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const [detailOrder, setDetailOrder] = useState<RestockOrder | null>(null)

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

    return (
        <div>
            <PageHeader
                title="Restock orders"
                description="Purchase orders from suppliers — draft, place, receive into inventory"
                actions={
                    isAdmin ? (
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="size-4" /> New order
                        </Button>
                    ) : null
                }
            />

            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
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
                        key: 'status',
                        label: 'Status',
                        render: (row) => <Badge variant={statusVariant(row.status as RestockOrder['status'])}>{String(row.status)}</Badge>
                    },
                    {
                        key: 'totalAmount',
                        label: 'Total',
                        render: (row) => Number(row.totalAmount ?? 0).toFixed(0)
                    },
                    {
                        key: 'items',
                        label: 'Items',
                        render: (row) => String((row.items as unknown[])?.length ?? 0)
                    },
                    {
                        key: 'createdAt',
                        label: 'Created',
                        render: (row) => (row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString() : '—')
                    }
                ]}
                rows={filtered as unknown as Record<string, unknown>[]}
                renderActions={(row) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailOrder(row as unknown as RestockOrder)}>
                        View
                    </Button>
                )}
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
                canManage={isAdmin}
                onSuccess={() => setDetailOrder(null)}
            />
        </div>
    )
}
