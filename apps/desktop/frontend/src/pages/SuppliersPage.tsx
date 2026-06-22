import { useMemo, useState } from 'react'
import { SupplierFormDialog } from '@/components/suppliers/SupplierFormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDeactivateSupplierMutation, useGetSuppliersQuery } from '@/redux/api/suppliersApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import type { Supplier } from '@/types/api'
import { Plus } from 'lucide-react'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/errors'
import { isAdminOrAbove } from '@/lib/roles'

export default function SuppliersPage() {
    const user = useSelector(selectCurrentUser)
    const isAdmin = isAdminOrAbove(user?.role)
    const { data, isLoading, refetch } = useGetSuppliersQuery(true)
    const [deactivateSupplier, { isLoading: deactivating }] = useDeactivateSupplierMutation()
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
    const [deactivateId, setDeactivateId] = useState<string | null>(null)

    const filtered = useMemo(() => {
        const list = data?.suppliers ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter((s) => s.name.toLowerCase().includes(q) || s.contact.includes(q) || (s.businessName ?? '').toLowerCase().includes(q))
    }, [data, search])

    return (
        <div>
            <PageHeader
                title="Suppliers"
                description="Manage supplier contacts and linked products"
                actions={
                    isAdmin ? (
                        <Button
                            onClick={() => {
                                setEditSupplier(null)
                                setFormOpen(true)
                            }}>
                            <Plus className="size-4" /> Add Supplier
                        </Button>
                    ) : null
                }
            />

            <div className="mb-4">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search suppliers..."
                />
            </div>

            <DataTable
                loading={isLoading}
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'contact', label: 'Contact' },
                    { key: 'businessName', label: 'Business' },
                    { key: 'email', label: 'Email' },
                    {
                        key: 'products',
                        label: 'Products',
                        render: (row) => String((row.products as unknown[])?.length ?? 0)
                    },
                    {
                        key: 'isActive',
                        label: 'Status',
                        render: (row) => <Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                    }
                ]}
                rows={filtered as unknown as Record<string, unknown>[]}
                renderActions={
                    isAdmin
                        ? (row) => (
                              <RowActions
                                  onEdit={() => {
                                      setEditSupplier(row as unknown as Supplier)
                                      setFormOpen(true)
                                  }}
                                  onDelete={row.isActive ? () => setDeactivateId(String(row.id ?? row._id)) : undefined}
                              />
                          )
                        : undefined
                }
            />

            <SupplierFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                supplier={editSupplier}
                onSuccess={() => {
                    setFormOpen(false)
                    setEditSupplier(null)
                    refetch()
                }}
            />

            <ConfirmDialog
                open={!!deactivateId}
                onOpenChange={() => setDeactivateId(null)}
                title="Deactivate supplier?"
                description="The supplier will be marked inactive but records are kept."
                onConfirm={async () => {
                    if (!deactivateId) return
                    try {
                        await deactivateSupplier(deactivateId).unwrap()
                        toast.success('Supplier deactivated')
                        setDeactivateId(null)
                        refetch()
                    } catch (err) {
                        toast.error(getApiErrorMessage(err, 'Deactivate failed'))
                    }
                }}
                loading={deactivating}
            />
        </div>
    )
}
