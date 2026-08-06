import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProductFormDialog, RestockDialog } from '@/components/products/ProductFormDialog'
import { CategorySidebar, collectDescendantIds, type CategoryFilter } from '@/components/products/CategorySidebar'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { usePermissions } from '@/hooks/usePermissions'
import { useLanguage } from '@/hooks/useLanguage'
import { useGetCategoriesQuery } from '@/redux/api/categoriesApi'
import { useDeleteProductMutation, useGetProductsQuery } from '@/redux/api/productsApi'
import type { Category, Product } from '@/types/api'
import { Plus, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function ProductActions({
    canWrite,
    canDelete,
    onRestock,
    onEdit,
    onDelete
}: {
    canWrite: boolean
    canDelete: boolean
    onRestock: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    if (!canWrite && !canDelete) return null
    return (
        <RowActions
            extra={
                canWrite ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRestock}>
                        Restock
                    </Button>
                ) : undefined
            }
            onEdit={canWrite ? onEdit : undefined}
            onDelete={canDelete ? onDelete : undefined}
        />
    )
}

function ProductTable({
    products,
    loading,
    canWrite,
    canDelete,
    onRestock,
    onEdit,
    onDelete
}: {
    products: Product[]
    loading?: boolean
    canWrite: boolean
    canDelete: boolean
    onRestock: (p: Product) => void
    onEdit: (p: Product) => void
    onDelete: (id: string) => void
}) {
    return (
        <DataTable
            loading={loading}
            columns={[
                { key: 'name', label: 'Product' },
                {
                    key: 'category',
                    label: 'Category',
                    render: (row) => {
                        const item = row as unknown as Product
                        if (item.categories?.length) {
                            return item.categories.map((c) => c.name).join(', ')
                        }
                        return item.category || '—'
                    }
                },
                {
                    key: 'unit',
                    label: 'Unit',
                    render: (row) => {
                        const item = row as unknown as Product
                        return item.unit?.name ?? '—'
                    }
                },
                { key: 'price', label: 'Customer price' },
                { key: 'stockQty', label: 'Stock' },
                {
                    key: 'inStock',
                    label: 'Status',
                    render: (row) => <Badge variant={row.inStock ? 'default' : 'destructive'}>{row.inStock ? 'In Stock' : 'Out of Stock'}</Badge>
                }
            ]}
            rows={products as unknown as Record<string, unknown>[]}
            renderActions={
                canWrite || canDelete
                    ? (row) => {
                          const product = row as unknown as Product
                          return (
                              <ProductActions
                                  canWrite={canWrite}
                                  canDelete={canDelete}
                                  onRestock={() => onRestock(product)}
                                  onEdit={() => onEdit(product)}
                                  onDelete={() => onDelete(String(product.id ?? product._id))}
                              />
                          )
                      }
                    : undefined
            }
        />
    )
}

function NestedCategoryGroups({
    nodes,
    productsByCategory,
    uncategorized,
    depth = 0,
    canWrite,
    canDelete,
    onRestock,
    onEdit,
    onDelete,
    emptyLabel
}: {
    nodes: Category[]
    productsByCategory: Map<string, Product[]>
    uncategorized: Product[]
    depth?: number
    canWrite: boolean
    canDelete: boolean
    onRestock: (p: Product) => void
    onEdit: (p: Product) => void
    onDelete: (id: string) => void
    emptyLabel: string
}) {
    return (
        <div className="space-y-2">
            {depth === 0 && uncategorized.length > 0 ? (
                <Collapsible
                    defaultOpen
                    className="rounded-xl border">
                    <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium">
                        <ChevronRight className="size-4 transition-transform [[data-state=open]_&]:rotate-90" />
                        Uncategorized
                        <Badge
                            variant="secondary"
                            className="ml-auto">
                            {uncategorized.length}
                        </Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t px-2 pb-2">
                        <ProductTable
                            products={uncategorized}
                            canWrite={canWrite}
                            canDelete={canDelete}
                            onRestock={onRestock}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </CollapsibleContent>
                </Collapsible>
            ) : null}

            {nodes.map((node) => {
                const id = node.id ?? node._id
                const products = productsByCategory.get(id) ?? []
                const hasChildren = Boolean(node.children?.length)
                const isEmpty = !products.length && !hasChildren

                return (
                    <Collapsible
                        key={id}
                        defaultOpen={depth < 2}
                        className="rounded-xl border">
                        <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium">
                            <ChevronRight className="size-4 transition-transform [[data-state=open]_&]:rotate-90" />
                            <span
                                className="truncate"
                                style={{ paddingLeft: `${depth * 4}px` }}>
                                {node.name}
                            </span>
                            <Badge
                                variant="secondary"
                                className="ml-auto">
                                {products.length}
                            </Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 border-t px-2 pb-2 pt-2">
                            {products.length ? (
                                <ProductTable
                                    products={products}
                                    canWrite={canWrite}
                                    canDelete={canDelete}
                                    onRestock={onRestock}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                />
                            ) : isEmpty ? (
                                <p className="text-muted-foreground px-2 py-3 text-sm">{emptyLabel}</p>
                            ) : null}
                            {hasChildren ? (
                                <div className={cn('space-y-2', depth > 0 && 'ml-2')}>
                                    <NestedCategoryGroups
                                        nodes={node.children!}
                                        productsByCategory={productsByCategory}
                                        uncategorized={[]}
                                        depth={depth + 1}
                                        canWrite={canWrite}
                                        canDelete={canDelete}
                                        onRestock={onRestock}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        emptyLabel={emptyLabel}
                                    />
                                </div>
                            ) : null}
                        </CollapsibleContent>
                    </Collapsible>
                )
            })}
        </div>
    )
}

export default function InventoryPage() {
    const { canWrite, canDelete } = usePermissions()
    const { t } = useLanguage()
    const { data, isLoading, refetch } = useGetProductsQuery()
    const { data: categoriesData } = useGetCategoriesQuery()
    const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
    const [formOpen, setFormOpen] = useState(false)
    const [restockOpen, setRestockOpen] = useState(false)
    const [editProduct, setEditProduct] = useState<Product | null>(null)
    const [restockProduct, setRestockProduct] = useState<Product | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const perPage = 10

    const categories = categoriesData?.categories ?? []

    const filtered = useMemo(() => {
        const list = data?.products ?? []
        const q = search.trim().toLowerCase()
        let next = list

        if (categoryFilter === 'uncategorized') {
            next = next.filter((p) => !p.categoryIds?.length && !p.categories?.length)
        } else if (categoryFilter !== 'all') {
            const allowed = collectDescendantIds(categories, categoryFilter)
            next = next.filter((p) => (p.categoryIds ?? p.categories?.map((c) => c.id ?? c._id) ?? []).some((id) => allowed.has(id)))
        }

        if (q) {
            next = next.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.category.toLowerCase().includes(q) ||
                    (p.categories ?? []).some((c) => c.name.toLowerCase().includes(q) || (c.path ?? '').toLowerCase().includes(q))
            )
        }
        return next
    }, [data, search, categoryFilter, categories])

    const rows = paginate(filtered, page, perPage)

    const productsByCategory = useMemo(() => {
        const map = new Map<string, Product[]>()
        for (const product of filtered) {
            const ids = product.categoryIds ?? product.categories?.map((c) => c.id ?? c._id) ?? []
            if (!ids.length) continue
            for (const id of ids) {
                const list = map.get(id) ?? []
                list.push(product)
                map.set(id, list)
            }
        }
        return map
    }, [filtered])

    const uncategorized = useMemo(() => filtered.filter((p) => !(p.categoryIds?.length || p.categories?.length)), [filtered])

    const showGrouped = categoryFilter === 'all' && !search.trim()

    return (
        <div>
            <PageHeader
                title={t.inventory.title}
                description={t.inventory.description}
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

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <CategorySidebar
                    categories={categories}
                    selectedId={categoryFilter}
                    onSelect={(id) => {
                        setCategoryFilter(id)
                        setPage(1)
                    }}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    labels={{
                        categories: t.inventory.categories,
                        allProducts: t.inventory.allProducts,
                        uncategorized: t.inventory.uncategorized,
                        addCategory: t.inventory.addCategory,
                        categoryName: t.inventory.categoryName,
                        parentCategory: t.inventory.parentCategory,
                        noParent: t.inventory.noParent,
                        createCategory: t.inventory.createCategory,
                        renameCategory: t.inventory.renameCategory
                    }}
                />

                <div className="min-w-0 flex-1">
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <SearchInput
                            value={search}
                            onChange={(value) => {
                                setSearch(value)
                                setPage(1)
                            }}
                            placeholder={t.inventory.searchPlaceholder}
                        />
                        {!showGrouped ? (
                            <PaginationControls
                                page={page}
                                totalPages={totalPages(filtered.length, perPage)}
                                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                                onNext={() => setPage((p) => p + 1)}
                            />
                        ) : null}
                    </div>

                    {showGrouped ? (
                        <NestedCategoryGroups
                            nodes={categories}
                            productsByCategory={productsByCategory}
                            uncategorized={uncategorized}
                            canWrite={canWrite}
                            canDelete={canDelete}
                            emptyLabel={t.inventory.emptyCategory}
                            onRestock={(product) => {
                                setRestockProduct(product)
                                setRestockOpen(true)
                            }}
                            onEdit={(product) => {
                                setEditProduct(product)
                                setFormOpen(true)
                            }}
                            onDelete={setDeleteId}
                        />
                    ) : (
                        <ProductTable
                            products={rows}
                            loading={isLoading}
                            canWrite={canWrite}
                            canDelete={canDelete}
                            onRestock={(product) => {
                                setRestockProduct(product)
                                setRestockOpen(true)
                            }}
                            onEdit={(product) => {
                                setEditProduct(product)
                                setFormOpen(true)
                            }}
                            onDelete={setDeleteId}
                        />
                    )}
                </div>
            </div>

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
