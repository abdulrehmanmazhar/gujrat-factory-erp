import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { useDeleteCustomerMutation, useGetCustomersQuery } from '@/redux/api/customersApi'
import type { Customer } from '@/types/api'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomersPage() {
    const { data, isLoading, refetch } = useGetCustomersQuery()
    const [deleteCustomer, { isLoading: deleting }] = useDeleteCustomerMutation()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [formOpen, setFormOpen] = useState(false)
    const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const perPage = 10

    const filtered = useMemo(() => {
        const list = data?.customers ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter((c) => c.name.toLowerCase().includes(q) || c.contact.includes(q))
    }, [data, search])

    const rows = paginate(filtered, page, perPage)

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            await deleteCustomer(deleteId).unwrap()
            toast.success('Customer deleted')
            setDeleteId(null)
            refetch()
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Delete failed')
        }
    }

    return (
        <div>
            <PageHeader
                title="Customers"
                description="Manage customer records and udhar balances"
                actions={
                    <Button
                        onClick={() => {
                            setEditCustomer(null)
                            setFormOpen(true)
                        }}>
                        <Plus className="size-4" /> Add Customer
                    </Button>
                }
            />

            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search customers..."
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
                    { key: 'name', label: 'Name' },
                    { key: 'contact', label: 'Contact' },
                    { key: 'udhar', label: 'Udhar' },
                    {
                        key: 'createdByUser',
                        label: 'Created By',
                        render: (row) => (row.createdByUser as { name?: string })?.name ?? '—'
                    }
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
                renderActions={(row) => (
                    <RowActions
                        onEdit={() => {
                            setEditCustomer(row as unknown as Customer)
                            setFormOpen(true)
                        }}
                        onDelete={() => setDeleteId(String(row.id ?? row._id))}
                    />
                )}
            />

            <CustomerFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                customer={editCustomer}
                onSuccess={() => {
                    setFormOpen(false)
                    setEditCustomer(null)
                    refetch()
                }}
            />

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
                title="Delete customer?"
                description="This action cannot be undone."
                onConfirm={handleDelete}
                loading={deleting}
            />
        </div>
    )
}
