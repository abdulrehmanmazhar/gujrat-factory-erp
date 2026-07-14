import { useMemo, useState } from 'react'
import { CreateRestockOrderDialog } from '@/components/suppliers/CreateRestockOrderDialog'
import { SupplierFormDialog } from '@/components/suppliers/SupplierFormDialog'
import { SupplierProductsDialog } from '@/components/suppliers/SupplierProductsDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDeactivateSupplierMutation, useGetSuppliersQuery } from '@/redux/api/suppliersApi'
import type { Supplier } from '@/types/api'
import { Package, Plus, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'

export default function SuppliersPage() {
    const { canWrite, canDelete } = usePermissions()
    const { data, isLoading, refetch } = useGetSuppliersQuery(true)
    const [deactivateSupplier, { isLoading: deactivating }] = useDeactivateSupplierMutation()
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
    const [productsSupplier, setProductsSupplier] = useState<Supplier | null>(null)
    const [restockSupplier, setRestockSupplier] = useState<Supplier | null>(null)
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
                description="Manage suppliers, link products, and create restock purchase orders"
                actions={
                    canWrite ? (
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
                    { key: 'contact', label: 'WhatsApp' },
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
                    canWrite
                        ? (row) => {
                              const supplier = row as unknown as Supplier
                              return (
                                  <RowActions
                                      extra={
                                          <>
                                              <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => setProductsSupplier(supplier)}>
                                                  <Package className="size-3.5" /> Products
                                              </Button>
                                              {supplier.isActive ? (
                                                  <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => setRestockSupplier(supplier)}>
                                                      <ShoppingCart className="size-3.5" /> Restock
                                                  </Button>
                                              ) : null}
                                          </>
                                      }
                                      onEdit={() => {
                                          setEditSupplier(supplier)
                                          setFormOpen(true)
                                      }}
                                      deleteLabel="Deactivate"
                                      onDelete={
                                          canDelete && supplier.isActive ? () => setDeactivateId(String(supplier.id ?? supplier._id)) : undefined
                                      }
                                  />
                              )
                          }
                        : (row) => (
                              <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setProductsSupplier(row as unknown as Supplier)}>
                                  View products
                              </Button>
                          )
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

            <SupplierProductsDialog
                open={!!productsSupplier}
                onOpenChange={() => setProductsSupplier(null)}
                supplier={productsSupplier}
                onSuccess={refetch}
            />

            <CreateRestockOrderDialog
                open={!!restockSupplier}
                onOpenChange={() => setRestockSupplier(null)}
                defaultSupplier={restockSupplier}
                onSuccess={() => {
                    setRestockSupplier(null)
                    toast.success('Go to Restock orders to manage the new order')
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
