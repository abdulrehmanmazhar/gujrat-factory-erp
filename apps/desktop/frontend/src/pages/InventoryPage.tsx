import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProductFormDialog, RestockDialog } from '@/components/products/ProductFormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteProductMutation, useGetProductsQuery } from '@/redux/api/productsApi'
import type { Product } from '@/types/api'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function InventoryPage() {
    const { canWrite, canDelete } = usePermissions()
    const { data, isLoading, refetch } = useGetProductsQuery()
    const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [formOpen, setFormOpen] = useState(false)
    const [restockOpen, setRestockOpen] = useState(false)
    const [editProduct, setEditProduct] = useState<Product | null>(null)
    const [restockProduct, setRestockProduct] = useState<Product | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const perPage = 10

    const filtered = useMemo(() => {
        const list = data?.products ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    }, [data, search])

    const rows = paginate(filtered, page, perPage)

    return (
        <div>
            <PageHeader
                title="Inventory"
                description="Manage products, stock levels, and restocking"
                actions={
                    canWrite ? (
                        <Button
                            onClick={() => {
                                setEditProduct(null)
                                setFormOpen(true)
                            }}>
                            <Plus className="size-4" /> Add Product
                        </Button>
                    ) : undefined
                }
            />

            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search products..."
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
                    { key: 'name', label: 'Product' },
                    { key: 'category', label: 'Category' },
                    { key: 'price', label: 'Price' },
                    { key: 'stockQty', label: 'Stock' },
                    {
                        key: 'inStock',
                        label: 'Status',
                        render: (row) => <Badge variant={row.inStock ? 'default' : 'destructive'}>{row.inStock ? 'In Stock' : 'Out of Stock'}</Badge>
                    }
                ]}
                rows={rows as unknown as Record<string, unknown>[]}
                renderActions={
                    canWrite || canDelete
                        ? (row) => (
                              <RowActions
                                  extra={
                                      canWrite ? (
                                          <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                  setRestockProduct(row as unknown as Product)
                                                  setRestockOpen(true)
                                              }}>
                                              Restock
                                          </Button>
                                      ) : undefined
                                  }
                                  onEdit={
                                      canWrite
                                          ? () => {
                                                setEditProduct(row as unknown as Product)
                                                setFormOpen(true)
                                            }
                                          : undefined
                                  }
                                  onDelete={canDelete ? () => setDeleteId(String(row.id ?? row._id)) : undefined}
                              />
                          )
                        : undefined
                }
            />

            <ProductFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                product={editProduct}
                onSuccess={() => {
                    setFormOpen(false)
                    refetch()
                }}
            />
            <RestockDialog
                open={restockOpen}
                onOpenChange={setRestockOpen}
                product={restockProduct}
                onSuccess={() => {
                    setRestockOpen(false)
                    refetch()
                }}
            />
            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
                title="Delete product?"
                onConfirm={async () => {
                    if (!deleteId) return
                    try {
                        await deleteProduct(deleteId).unwrap()
                        toast.success('Product deleted')
                        setDeleteId(null)
                        refetch()
                    } catch (err) {
                        toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Delete failed')
                    }
                }}
                loading={deleting}
            />
        </div>
    )
}
