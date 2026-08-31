import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { collectDescendantIds } from '@/components/products/CategorySidebar'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { PageHeader } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { useGetCategoriesQuery } from '@/redux/api/categoriesApi'
import {
    useGetInventoryCustomerAnalyticsQuery,
    useGetInventoryLabourAnalyticsQuery,
    useGetInventorySupplierAnalyticsQuery
} from '@/redux/api/analyticsApi'
import type { Category, InventoryProductLine } from '@/types/api'
import { Boxes, ChevronRight, HardHat, Package, Truck, Users } from 'lucide-react'

const PER_PAGE = 10

function formatPkr(amount: number) {
    return `PKR ${Number(amount || 0).toLocaleString()}`
}

function formatQty(qty: number, unit?: string) {
    const amount = Number(qty || 0).toLocaleString()
    return unit ? `${amount} ${unit}` : amount
}

function flattenCategoryOptions(nodes: Category[]) {
    const options: { id: string; label: string }[] = []
    const walk = (list: Category[]) => {
        for (const node of list) {
            options.push({ id: node.id ?? node._id, label: node.path || node.name })
            if (node.children?.length) walk(node.children)
        }
    }
    walk(nodes)
    return options
}

function productMatchesCategory(product: InventoryProductLine, allowedIds: Set<string> | null, categoryName?: string) {
    if (!allowedIds) return true
    if (product.categoryIds.some((id) => allowedIds.has(id))) return true
    if (categoryName && product.category.toLowerCase() === categoryName.toLowerCase()) return true
    return false
}

function filterProductLines(products: InventoryProductLine[], query: string, allowedIds: Set<string> | null, categoryName?: string) {
    return products.filter((product) => {
        if (!productMatchesCategory(product, allowedIds, categoryName)) return false
        if (!query) return true
        return (
            product.name.toLowerCase().includes(query) ||
            product.category.toLowerCase().includes(query) ||
            product.unitName.toLowerCase().includes(query)
        )
    })
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="bg-card rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
        </div>
    )
}

function ProductsTable({
    rows,
    emptyMessage,
    variant
}: {
    rows: InventoryProductLine[]
    emptyMessage: string
    variant: 'sold' | 'restock' | 'produced' | 'consumed'
}) {
    if (!rows.length) {
        return <p className="text-muted-foreground px-1 py-3 text-sm">{emptyMessage}</p>
    }

    const showRestock = variant === 'restock'
    const valueLabel = variant === 'produced' ? 'Pay' : variant === 'consumed' ? '' : 'Value'
    const countLabel = variant === 'produced' || variant === 'consumed' ? 'Logs' : variant === 'restock' ? 'Restocks' : 'Orders'
    const totalQty = rows.reduce((sum, row) => sum + row.qty, 0)
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0)
    const totalCount = rows.reduce((sum, row) => sum + row.orderCount, 0)
    const totalReceived = rows.reduce((sum, row) => sum + (row.qtyReceived ?? 0), 0)
    const totalReturned = rows.reduce((sum, row) => sum + (row.qtyReturned ?? 0), 0)

    return (
        <div className="bg-background rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty</TableHead>
                        {showRestock ? <TableHead>Received</TableHead> : null}
                        {showRestock ? <TableHead>Returned</TableHead> : null}
                        <TableHead>{countLabel}</TableHead>
                        {valueLabel ? <TableHead>{valueLabel}</TableHead> : null}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.productId}>
                            <TableCell className="whitespace-normal">
                                <p className="font-medium">{row.name}</p>
                                <p className="text-muted-foreground text-xs">{row.unitName}</p>
                            </TableCell>
                            <TableCell>{row.category || '—'}</TableCell>
                            <TableCell>{formatQty(row.qty, row.unitName)}</TableCell>
                            {showRestock ? <TableCell>{formatQty(row.qtyReceived ?? 0, row.unitName)}</TableCell> : null}
                            {showRestock ? <TableCell>{formatQty(row.qtyReturned ?? 0, row.unitName)}</TableCell> : null}
                            <TableCell>{row.orderCount.toLocaleString()}</TableCell>
                            {valueLabel ? <TableCell>{formatPkr(row.value)}</TableCell> : null}
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell className="font-medium">Total</TableCell>
                        <TableCell>{rows.length.toLocaleString()} products</TableCell>
                        <TableCell>{totalQty.toLocaleString()}</TableCell>
                        {showRestock ? <TableCell>{totalReceived.toLocaleString()}</TableCell> : null}
                        {showRestock ? <TableCell>{totalReturned.toLocaleString()}</TableCell> : null}
                        <TableCell>{totalCount.toLocaleString()}</TableCell>
                        {valueLabel ? <TableCell>{formatPkr(totalValue)}</TableCell> : null}
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    )
}

function PartyRow({
    expanded,
    onToggle,
    colSpan,
    cells,
    children
}: {
    expanded: boolean
    onToggle: () => void
    colSpan: number
    cells: ReactNode
    children: ReactNode
}) {
    return (
        <>
            <TableRow
                className={cn('cursor-pointer', expanded && 'bg-muted/40')}
                onClick={onToggle}>
                <TableCell className="w-8">
                    <ChevronRight className={cn('text-muted-foreground size-4 transition-transform', expanded && 'rotate-90')} />
                </TableCell>
                {cells}
            </TableRow>
            {expanded ? (
                <TableRow className="hover:bg-transparent">
                    <TableCell
                        colSpan={colSpan}
                        className="bg-muted/20 whitespace-normal p-0">
                        <div className="space-y-3 p-3">{children}</div>
                    </TableCell>
                </TableRow>
            ) : null}
        </>
    )
}

export default function InventoryAnalyticsPage() {
    const { canWrite } = usePermissions()
    const [tab, setTab] = useState('customers')
    const [search, setSearch] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [page, setPage] = useState(1)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const { data: categoriesData } = useGetCategoriesQuery()
    const customersQuery = useGetInventoryCustomerAnalyticsQuery({ from, to }, { skip: tab !== 'customers' })
    const suppliersQuery = useGetInventorySupplierAnalyticsQuery({ from, to }, { skip: !canWrite || tab !== 'suppliers' })
    const labourQuery = useGetInventoryLabourAnalyticsQuery({ from, to }, { skip: !canWrite || tab !== 'labour' })

    const categories = categoriesData?.categories ?? []
    const categoryOptions = useMemo(() => flattenCategoryOptions(categories), [categories])
    const allowedCategoryIds = useMemo(() => {
        if (categoryFilter === 'all') return null
        return collectDescendantIds(categories, categoryFilter)
    }, [categories, categoryFilter])
    const selectedCategoryName = categoryOptions
        .find((option) => option.id === categoryFilter)
        ?.label?.split(' / ')
        .pop()

    useEffect(() => {
        setPage(1)
        setExpandedId(null)
    }, [search, from, to, categoryFilter, tab])

    const query = search.trim().toLowerCase()

    const customerRows = useMemo(() => {
        const list = customersQuery.data?.customers ?? []
        return list
            .map((customer) => {
                const products = filterProductLines(customer.products, query, allowedCategoryIds, selectedCategoryName)
                return {
                    ...customer,
                    products,
                    productCount: products.length,
                    totalQty: products.reduce((sum, row) => sum + row.qty, 0),
                    totalValue: products.reduce((sum, row) => sum + row.value, 0),
                    orderCount: products.reduce((sum, row) => sum + row.orderCount, 0)
                }
            })
            .filter((customer) => {
                if (query) {
                    const hit =
                        customer.name.toLowerCase().includes(query) ||
                        customer.contact.toLowerCase().includes(query) ||
                        customer.address.toLowerCase().includes(query) ||
                        customer.products.length > 0
                    if (!hit) return false
                }
                if (from || to || categoryFilter !== 'all') return customer.totalQty > 0
                return true
            })
    }, [customersQuery.data, query, allowedCategoryIds, selectedCategoryName, from, to, categoryFilter])

    const supplierRows = useMemo(() => {
        const list = suppliersQuery.data?.suppliers ?? []
        return list
            .map((supplier) => {
                const products = filterProductLines(supplier.products, query, allowedCategoryIds, selectedCategoryName)
                return {
                    ...supplier,
                    products,
                    productCount: products.length,
                    totalQty: products.reduce((sum, row) => sum + row.qty, 0),
                    totalValue: products.reduce((sum, row) => sum + row.value, 0),
                    orderCount: products.reduce((sum, row) => sum + row.orderCount, 0)
                }
            })
            .filter((supplier) => {
                if (query) {
                    const hit =
                        supplier.name.toLowerCase().includes(query) ||
                        supplier.contact.toLowerCase().includes(query) ||
                        (supplier.businessName ?? '').toLowerCase().includes(query) ||
                        (supplier.address ?? '').toLowerCase().includes(query) ||
                        supplier.products.length > 0
                    if (!hit) return false
                }
                if (from || to || categoryFilter !== 'all') return supplier.totalQty > 0
                return true
            })
    }, [suppliersQuery.data, query, allowedCategoryIds, selectedCategoryName, from, to, categoryFilter])

    const labourRows = useMemo(() => {
        const list = labourQuery.data?.labourers ?? []
        return list
            .map((labourer) => {
                const produced = filterProductLines(labourer.produced, query, allowedCategoryIds, selectedCategoryName)
                const consumed = filterProductLines(labourer.consumed, query, allowedCategoryIds, selectedCategoryName)
                return {
                    ...labourer,
                    produced,
                    consumed,
                    productCount: produced.length,
                    productionCount: produced.reduce((sum, row) => sum + row.orderCount, 0),
                    producedQty: produced.reduce((sum, row) => sum + row.qty, 0),
                    producedValue: produced.reduce((sum, row) => sum + row.value, 0),
                    consumedQty: consumed.reduce((sum, row) => sum + row.qty, 0)
                }
            })
            .filter((labourer) => {
                if (query) {
                    const hit =
                        labourer.name.toLowerCase().includes(query) ||
                        (labourer.contact ?? '').toLowerCase().includes(query) ||
                        (labourer.notes ?? '').toLowerCase().includes(query) ||
                        labourer.produced.length > 0 ||
                        labourer.consumed.length > 0
                    if (!hit) return false
                }
                if (from || to || categoryFilter !== 'all') return labourer.producedQty > 0 || labourer.consumedQty > 0
                return true
            })
    }, [labourQuery.data, query, allowedCategoryIds, selectedCategoryName, from, to, categoryFilter])

    const customerSummary = useMemo(() => {
        const productIds = new Set<string>()
        let totalQty = 0
        let totalValue = 0
        let orderCount = 0
        for (const customer of customerRows) {
            totalQty += customer.totalQty
            totalValue += customer.totalValue
            orderCount += customer.orderCount
            for (const product of customer.products) productIds.add(product.productId)
        }
        return { parties: customerRows.length, products: productIds.size, totalQty, totalValue, orderCount }
    }, [customerRows])

    const supplierSummary = useMemo(() => {
        const productIds = new Set<string>()
        let totalQty = 0
        let totalValue = 0
        let orderCount = 0
        for (const supplier of supplierRows) {
            totalQty += supplier.totalQty
            totalValue += supplier.totalValue
            orderCount += supplier.orderCount
            for (const product of supplier.products) productIds.add(product.productId)
        }
        return { parties: supplierRows.length, products: productIds.size, totalQty, totalValue, orderCount }
    }, [supplierRows])

    const labourSummary = useMemo(() => {
        const producedIds = new Set<string>()
        const consumedIds = new Set<string>()
        let producedQty = 0
        let consumedQty = 0
        let producedValue = 0
        let logs = 0
        for (const labourer of labourRows) {
            producedQty += labourer.producedQty
            consumedQty += labourer.consumedQty
            producedValue += labourer.producedValue
            logs += labourer.productionCount
            for (const product of labourer.produced) producedIds.add(product.productId)
            for (const product of labourer.consumed) consumedIds.add(product.productId)
        }
        return {
            parties: labourRows.length,
            producedProducts: producedIds.size,
            consumedProducts: consumedIds.size,
            producedQty,
            consumedQty,
            producedValue,
            logs
        }
    }, [labourRows])

    const activeCount = tab === 'customers' ? customerRows.length : tab === 'suppliers' ? supplierRows.length : labourRows.length
    const customerPageRows = paginate(customerRows, page, PER_PAGE)
    const supplierPageRows = paginate(supplierRows, page, PER_PAGE)
    const labourPageRows = paginate(labourRows, page, PER_PAGE)
    const isLoading = tab === 'customers' ? customersQuery.isLoading : tab === 'suppliers' ? suppliersQuery.isLoading : labourQuery.isLoading

    return (
        <div>
            <PageHeader
                title="Inventory analytics"
                description="Products sold to customers, received from suppliers, and produced or consumed by labour"
            />

            <Tabs
                value={tab}
                onValueChange={setTab}
                className="space-y-4">
                <TabsList>
                    <TabsTrigger value="customers">
                        <Users className="size-3.5" /> Customers
                    </TabsTrigger>
                    {canWrite ? (
                        <TabsTrigger value="suppliers">
                            <Truck className="size-3.5" /> Suppliers
                        </TabsTrigger>
                    ) : null}
                    {canWrite ? (
                        <TabsTrigger value="labour">
                            <HardHat className="size-3.5" /> Labour
                        </TabsTrigger>
                    ) : null}
                </TabsList>

                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search party, product, or category..."
                        className="max-w-lg"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="space-y-1">
                            <Label htmlFor="inventory-category-filter">Category</Label>
                            <Select
                                value={categoryFilter}
                                onValueChange={setCategoryFilter}>
                                <SelectTrigger
                                    id="inventory-category-filter"
                                    className="w-56">
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All categories</SelectItem>
                                    {categoryOptions.map((option) => (
                                        <SelectItem
                                            key={option.id}
                                            value={option.id}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DateRangeFilter
                            from={from}
                            to={to}
                            onFromChange={setFrom}
                            onToChange={setTo}
                        />
                        <PaginationControls
                            page={page}
                            totalPages={totalPages(activeCount, PER_PAGE)}
                            onPrev={() => setPage((value) => Math.max(1, value - 1))}
                            onNext={() => setPage((value) => value + 1)}
                        />
                    </div>
                </div>

                <TabsContent value="customers">
                    <SectionCards
                        cards={[
                            { label: 'Customers', value: customerSummary.parties.toLocaleString(), hint: 'With matching product sales' },
                            { label: 'Products sold', value: customerSummary.products.toLocaleString(), hint: 'Distinct products in the filters' },
                            { label: 'Total qty sold', value: customerSummary.totalQty.toLocaleString(), hint: 'All matching line quantities' },
                            { label: 'Sales value', value: formatPkr(customerSummary.totalValue), hint: 'Qty × (unit price − discount)' }
                        ]}
                    />
                    <InventoryTable
                        loading={isLoading}
                        colSpan={6}
                        emptyMessage="No customer inventory found"
                        headers={['Customer', 'Orders', 'Products', 'Qty sold', 'Value']}
                        rows={customerPageRows}
                        expandedId={expandedId}
                        onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                        renderCells={(customer) => (
                            <>
                                <TableCell className="whitespace-normal">
                                    <p className="font-medium">{customer.name}</p>
                                    <p className="text-muted-foreground text-xs">{customer.contact}</p>
                                    <p className="text-muted-foreground max-w-xs truncate text-xs">{customer.address}</p>
                                </TableCell>
                                <TableCell>{customer.orderCount.toLocaleString()}</TableCell>
                                <TableCell>{customer.productCount.toLocaleString()}</TableCell>
                                <TableCell>{customer.totalQty.toLocaleString()}</TableCell>
                                <TableCell>{formatPkr(customer.totalValue)}</TableCell>
                            </>
                        )}
                        renderNested={(customer) => (
                            <>
                                <h4 className="flex items-center gap-2 text-sm font-semibold">
                                    <Package className="size-4" /> Inventory purchased
                                </h4>
                                <ProductsTable
                                    rows={customer.products}
                                    emptyMessage="No products sold to this customer in the selected filters"
                                    variant="sold"
                                />
                            </>
                        )}
                    />
                </TabsContent>

                {canWrite ? (
                    <TabsContent value="suppliers">
                        <SectionCards
                            cards={[
                                { label: 'Suppliers', value: supplierSummary.parties.toLocaleString(), hint: 'With matching received stock' },
                                {
                                    label: 'Products received',
                                    value: supplierSummary.products.toLocaleString(),
                                    hint: 'Distinct products in the filters'
                                },
                                { label: 'Net qty received', value: supplierSummary.totalQty.toLocaleString(), hint: 'Received minus returned' },
                                { label: 'Restock value', value: formatPkr(supplierSummary.totalValue), hint: 'Net qty × unit cost' }
                            ]}
                        />
                        <InventoryTable
                            loading={isLoading}
                            colSpan={6}
                            emptyMessage="No supplier inventory found"
                            headers={['Supplier', 'Restocks', 'Products', 'Net qty', 'Value']}
                            rows={supplierPageRows}
                            expandedId={expandedId}
                            onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                            renderCells={(supplier) => (
                                <>
                                    <TableCell className="whitespace-normal">
                                        <p className="font-medium">
                                            {supplier.name}
                                            {supplier.isActive ? null : <span className="text-muted-foreground ml-1 text-xs">(inactive)</span>}
                                        </p>
                                        <p className="text-muted-foreground text-xs">{supplier.contact}</p>
                                        <p className="text-muted-foreground max-w-xs truncate text-xs">
                                            {supplier.businessName || supplier.address || '—'}
                                        </p>
                                    </TableCell>
                                    <TableCell>{supplier.orderCount.toLocaleString()}</TableCell>
                                    <TableCell>{supplier.productCount.toLocaleString()}</TableCell>
                                    <TableCell>{supplier.totalQty.toLocaleString()}</TableCell>
                                    <TableCell>{formatPkr(supplier.totalValue)}</TableCell>
                                </>
                            )}
                            renderNested={(supplier) => (
                                <>
                                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                                        <Boxes className="size-4" /> Inventory received
                                    </h4>
                                    <ProductsTable
                                        rows={supplier.products}
                                        emptyMessage="No products received from this supplier in the selected filters"
                                        variant="restock"
                                    />
                                </>
                            )}
                        />
                    </TabsContent>
                ) : null}

                {canWrite ? (
                    <TabsContent value="labour">
                        <SectionCards
                            cards={[
                                { label: 'Workers', value: labourSummary.parties.toLocaleString(), hint: 'With matching production' },
                                { label: 'Qty produced', value: labourSummary.producedQty.toLocaleString(), hint: 'Finished goods in the filters' },
                                { label: 'Materials used', value: labourSummary.consumedQty.toLocaleString(), hint: 'Ingredients consumed' },
                                { label: 'Production pay', value: formatPkr(labourSummary.producedValue), hint: 'Pay tied to produced qty' }
                            ]}
                        />
                        <InventoryTable
                            loading={isLoading}
                            colSpan={6}
                            emptyMessage="No labour inventory found"
                            headers={['Worker', 'Logs', 'Produced', 'Consumed', 'Pay']}
                            rows={labourPageRows}
                            expandedId={expandedId}
                            onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                            renderCells={(labourer) => (
                                <>
                                    <TableCell className="whitespace-normal">
                                        <p className="font-medium">
                                            {labourer.name}
                                            {labourer.isActive ? null : <span className="text-muted-foreground ml-1 text-xs">(inactive)</span>}
                                        </p>
                                        <p className="text-muted-foreground text-xs">{labourer.contact || '—'}</p>
                                    </TableCell>
                                    <TableCell>{labourer.productionCount.toLocaleString()}</TableCell>
                                    <TableCell>{labourer.producedQty.toLocaleString()}</TableCell>
                                    <TableCell>{labourer.consumedQty.toLocaleString()}</TableCell>
                                    <TableCell>{formatPkr(labourer.producedValue)}</TableCell>
                                </>
                            )}
                            renderNested={(labourer) => (
                                <>
                                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                                        <Package className="size-4" /> Products produced
                                    </h4>
                                    <ProductsTable
                                        rows={labourer.produced}
                                        emptyMessage="No finished goods produced in the selected filters"
                                        variant="produced"
                                    />
                                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                                        <Boxes className="size-4" /> Materials consumed
                                    </h4>
                                    <ProductsTable
                                        rows={labourer.consumed}
                                        emptyMessage="No materials were consumed in the selected filters"
                                        variant="consumed"
                                    />
                                </>
                            )}
                        />
                    </TabsContent>
                ) : null}
            </Tabs>
        </div>
    )
}

function SectionCards({ cards }: { cards: { label: string; value: string; hint?: string }[] }) {
    return (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <SummaryCard
                    key={card.label}
                    {...card}
                />
            ))}
        </div>
    )
}

function InventoryTable<T extends { id: string; _id: string }>({
    loading,
    headers,
    rows,
    colSpan,
    emptyMessage,
    expandedId,
    onToggle,
    renderCells,
    renderNested
}: {
    loading: boolean
    headers: string[]
    rows: T[]
    colSpan: number
    emptyMessage: string
    expandedId: string | null
    onToggle: (id: string) => void
    renderCells: (row: T) => ReactNode
    renderNested: (row: T) => ReactNode
}) {
    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton
                        key={index}
                        className="h-12 w-full"
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-8" />
                        {headers.map((header) => (
                            <TableHead key={header}>{header}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={colSpan}
                                className="text-muted-foreground text-center">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        rows.map((row) => {
                            const id = row.id ?? row._id
                            return (
                                <PartyRow
                                    key={id}
                                    expanded={expandedId === id}
                                    onToggle={() => onToggle(id)}
                                    colSpan={colSpan}
                                    cells={renderCells(row)}>
                                    {renderNested(row)}
                                </PartyRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
