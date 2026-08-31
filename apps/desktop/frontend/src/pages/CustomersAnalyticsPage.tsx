import { useEffect, useMemo, useState } from 'react'
import { CustomerAnalyticsTransactionDialog, type CustomerAnalyticsTxnContext } from '@/components/customers/CustomerAnalyticsTransactionDialog'
import { OrderViewDialog } from '@/components/orders/OrderViewDialog'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { PageHeader } from '@/components/shared/PageHeader'
import { PaginationControls, paginate, totalPages } from '@/components/shared/PaginationControls'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/errors'
import { useExportCustomerBalanceSheetMutation, useGetCustomerAnalyticsDetailQuery, useGetCustomerAnalyticsQuery } from '@/redux/api/analyticsApi'
import { useDeleteCustomerTransactionMutation } from '@/redux/api/customersApi'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { BalanceSheetDownloadButton } from '@/components/shared/BalanceSheetDownloadButton'
import { downloadBlob } from '@/lib/download'
import type { CustomerAnalyticsOrder, CustomerAnalyticsRow, CustomerAnalyticsTransaction, KhataDirection } from '@/types/api'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, ExternalLink, Eye, ShoppingCart, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'

const PER_PAGE = 10

function formatPkr(amount: number) {
    return `PKR ${Number(amount || 0).toLocaleString()}`
}

function balanceSheetFilename(label: string, name: string) {
    const datePart = new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
    const safeName =
        name
            .replace(/[^\w\-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'party'
    return `${label}-balance-sheet-${safeName}-${datePart}.xlsx`
}

function formatDate(value?: string) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function txnTypeLabel(type: string) {
    if (type === 'order') return 'Invoice charge'
    if (type === 'order_credit') return 'Order credit'
    if (type === 'sale') return 'Order payment'
    if (type === 'udhar_payment') return 'Standalone In'
    if (type === 'refund') return 'Refund / Out'
    return type
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

function TransactionsTable({
    rows,
    emptyMessage,
    canDelete,
    onDelete
}: {
    rows: CustomerAnalyticsTransaction[]
    emptyMessage: string
    canDelete?: boolean
    onDelete?: (id: string) => void
}) {
    if (!rows.length) {
        return <p className="text-muted-foreground px-1 py-3 text-sm">{emptyMessage}</p>
    }

    return (
        <div className="rounded-lg border bg-background">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Proof</TableHead>
                        {canDelete ? <TableHead className="w-10" /> : null}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => {
                        const id = row.id ?? row._id
                        return (
                            <TableRow key={id}>
                                <TableCell>{formatDate(row.createdAt)}</TableCell>
                                <TableCell>
                                    <Badge variant={row.direction === 'in' ? 'default' : 'secondary'}>{row.direction === 'in' ? 'In' : 'Out'}</Badge>
                                </TableCell>
                                <TableCell>{txnTypeLabel(row.type)}</TableCell>
                                <TableCell>{formatPkr(row.amount)}</TableCell>
                                <TableCell className="capitalize">{row.paymentMode || '—'}</TableCell>
                                <TableCell className="max-w-xs whitespace-normal">
                                    <span className="line-clamp-2">{row.description || '—'}</span>
                                </TableCell>
                                <TableCell>
                                    {row.proofImage ? (
                                        <Button
                                            asChild
                                            variant="link"
                                            className="h-auto p-0">
                                            <a
                                                href={row.proofImage}
                                                target="_blank"
                                                rel="noopener noreferrer">
                                                View
                                                <ExternalLink className="ml-1 size-3.5" />
                                            </a>
                                        </Button>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                                {canDelete ? (
                                    <TableCell>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => onDelete?.(id)}>
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </TableCell>
                                ) : null}
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

function OrderRow({
    order,
    canWrite,
    canDelete,
    onNewTransaction,
    onDeleteTxn
}: {
    order: CustomerAnalyticsOrder
    canWrite: boolean
    canDelete: boolean
    onNewTransaction: (direction?: KhataDirection) => void
    onDeleteTxn: (id: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [viewOpen, setViewOpen] = useState(false)
    const id = order.id ?? order._id
    const canPay = (order.status === 'saved' || !order.status) && order.outstanding > 0
    const canRefund = orderRefundable(order) > 0

    return (
        <div className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    onClick={() => setOpen((value) => !value)}>
                    <ChevronRight className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-90')} />
                    <span className="font-medium">Order #{order.orderNumber ?? id.slice(0, 8)}</span>
                    <Badge variant="outline">{order.status || 'saved'}</Badge>
                    <span className="text-muted-foreground hidden text-xs sm:inline">{formatDate(order.createdAt)}</span>
                </button>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>Payable {formatPkr(order.payable)}</span>
                    <span>Paid {formatPkr(order.payment ?? 0)}</span>
                    <span>Refunded {formatPkr(order.refunded ?? 0)}</span>
                    <span>Due {formatPkr(order.outstanding)}</span>
                </div>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setViewOpen(true)}>
                        <Eye className="size-3.5" /> View
                    </Button>
                    {canWrite ? (
                        <>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canPay}
                                onClick={() => onNewTransaction('in')}>
                                <ArrowDownLeft className="size-3.5" /> Pay
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canRefund}
                                onClick={() => onNewTransaction('out')}>
                                <ArrowUpRight className="size-3.5" /> Refund
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>
            <OrderViewDialog
                open={viewOpen}
                onOpenChange={setViewOpen}
                orderId={id}
            />
            {open ? (
                <div className="space-y-2 border-t px-3 py-3">
                    <p className="text-sm font-medium">Order transactions</p>
                    <TransactionsTable
                        rows={order.transactions}
                        emptyMessage="No transactions linked to this order"
                        canDelete={canDelete}
                        onDelete={onDeleteTxn}
                    />
                </div>
            ) : null}
        </div>
    )
}

function orderRefundable(order: CustomerAnalyticsOrder) {
    return Math.max(0, (order.payment ?? 0) - (order.refunded ?? 0))
}

function CustomerDetail({
    customerId,
    canWrite,
    canDelete,
    onNewTransaction,
    onDeleteTxn
}: {
    customerId: string
    canWrite: boolean
    canDelete: boolean
    onNewTransaction: (context: CustomerAnalyticsTxnContext) => void
    onDeleteTxn: (id: string) => void
}) {
    const { data, isLoading, isError } = useGetCustomerAnalyticsDetailQuery(customerId)

    if (isLoading) {
        return (
            <div className="space-y-2 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        )
    }

    if (isError || !data) {
        return <p className="text-destructive p-3 text-sm">Could not load customer orders and transactions.</p>
    }

    return (
        <div className="space-y-5 p-3">
            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <ShoppingCart className="size-4" /> Orders
                    </h4>
                    {canWrite ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onNewTransaction({ customerId, orderId: null })}>
                            New transaction
                        </Button>
                    ) : null}
                </div>
                {data.orders.length ? (
                    <div className="space-y-2">
                        {data.orders.map((order) => (
                            <OrderRow
                                key={order.id ?? order._id}
                                order={order}
                                canWrite={canWrite}
                                canDelete={canDelete}
                                onNewTransaction={(direction) =>
                                    onNewTransaction({
                                        customerId,
                                        orderId: order.id ?? order._id,
                                        direction
                                    })
                                }
                                onDeleteTxn={onDeleteTxn}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">No orders for this customer.</p>
                )}
            </section>

            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <Wallet className="size-4" /> Standalone In/Out
                    </h4>
                    {canWrite ? (
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onNewTransaction({ customerId, orderId: null, direction: 'in' })}>
                                <ArrowDownLeft className="size-3.5" /> In
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onNewTransaction({ customerId, orderId: null, direction: 'out' })}>
                                <ArrowUpRight className="size-3.5" /> Out
                            </Button>
                        </div>
                    ) : null}
                </div>
                <TransactionsTable
                    rows={data.standaloneTransactions}
                    emptyMessage="No standalone transactions — these are In/Out entries not linked to an order"
                    canDelete={canDelete}
                    onDelete={onDeleteTxn}
                />
            </section>
        </div>
    )
}

export default function CustomersAnalyticsPage() {
    const { canWrite, canDelete } = usePermissions()
    const [search, setSearch] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [page, setPage] = useState(1)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogContext, setDialogContext] = useState<CustomerAnalyticsTxnContext | null>(null)
    const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null)
    const [downloadingId, setDownloadingId] = useState<string | null>(null)
    const [deleteTxn, { isLoading: deletingTxn }] = useDeleteCustomerTransactionMutation()
    const [exportBalanceSheet] = useExportCustomerBalanceSheetMutation()

    const { data, isLoading, refetch } = useGetCustomerAnalyticsQuery({ from, to, q: search.trim() || undefined })

    useEffect(() => {
        setPage(1)
        setExpandedId(null)
    }, [search, from, to])

    const filtered = useMemo(() => {
        const list = data?.customers ?? []
        if (search.trim()) return list
        if (from || to) {
            return list.filter((customer) => customer.orderCount > 0 || customer.totalIn > 0 || customer.totalOut > 0 || customer.totalSales > 0)
        }
        return list
    }, [data, search, from, to])

    const summary = useMemo(() => {
        return filtered.reduce(
            (acc, customer) => {
                acc.totalSales += customer.totalSales
                acc.totalOrders += customer.orderCount
                acc.totalIn += customer.totalIn
                acc.totalOut += customer.totalOut
                return acc
            },
            { totalSales: 0, totalOrders: 0, totalIn: 0, totalOut: 0 }
        )
    }, [filtered])

    const rows = paginate(filtered, page, PER_PAGE)
    const colSpan = 7

    const handleDownloadBalanceSheet = async (id: string, name: string) => {
        try {
            setDownloadingId(id)
            const blob = await exportBalanceSheet({
                id,
                from: from || undefined,
                to: to || undefined,
                q: search.trim() || undefined
            }).unwrap()
            downloadBlob(blob, balanceSheetFilename('customer', name))
            toast.success('Balance sheet downloaded')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not download balance sheet'))
        } finally {
            setDownloadingId(null)
        }
    }

    const openDialog = (context: CustomerAnalyticsTxnContext | null = null) => {
        setDialogContext(context)
        setDialogOpen(true)
    }

    const toggleExpanded = (id: string) => {
        setExpandedId((current) => (current === id ? null : id))
    }

    return (
        <div>
            <PageHeader
                title="Customers analytics"
                description="Sales, orders, and nested In/Out history for every customer"
                actions={
                    canWrite ? (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={() => openDialog({ direction: 'in' })}>
                                <ArrowDownLeft className="size-4" /> Transaction In
                            </Button>
                            <Button onClick={() => openDialog({ direction: 'out' })}>
                                <ArrowUpRight className="size-4" /> Transaction Out
                            </Button>
                        </div>
                    ) : undefined
                }
            />

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard
                    label="Total sales"
                    value={formatPkr(summary.totalSales)}
                    hint="Saved order totals in the selected range"
                />
                <SummaryCard
                    label="Total orders"
                    value={summary.totalOrders.toLocaleString()}
                    hint="Finalized orders in the selected range"
                />
                <SummaryCard
                    label="Total In"
                    value={formatPkr(summary.totalIn)}
                    hint="Payments and credits received"
                />
                <SummaryCard
                    label="Total Out"
                    value={formatPkr(summary.totalOut)}
                    hint="Refunds and money paid out"
                />
                <SummaryCard
                    label="Net (In − Out)"
                    value={formatPkr(summary.totalIn - summary.totalOut)}
                />
            </div>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search name, contact, order #, or transaction notes…"
                    className="max-w-lg"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <DateRangeFilter
                        from={from}
                        to={to}
                        onFromChange={setFrom}
                        onToChange={setTo}
                    />
                    <PaginationControls
                        page={page}
                        totalPages={totalPages(filtered.length, PER_PAGE)}
                        onPrev={() => setPage((value) => Math.max(1, value - 1))}
                        onNext={() => setPage((value) => value + 1)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton
                            key={index}
                            className="h-12 w-full"
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8" />
                                <TableHead>Customer</TableHead>
                                <TableHead>Orders</TableHead>
                                <TableHead>In</TableHead>
                                <TableHead>Out</TableHead>
                                <TableHead>Net</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={colSpan}
                                        className="text-muted-foreground text-center">
                                        No customers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((customer) => {
                                    const id = customer.id ?? customer._id
                                    const expanded = expandedId === id
                                    return (
                                        <CustomerRows
                                            key={id}
                                            customer={customer}
                                            expanded={expanded}
                                            canWrite={canWrite}
                                            canDelete={canDelete}
                                            colSpan={colSpan}
                                            onToggle={() => toggleExpanded(id)}
                                            onNewTransaction={(context) => openDialog({ customerId: id, ...context })}
                                            onDeleteTxn={setDeleteTxnId}
                                            onDownloadBalanceSheet={() => void handleDownloadBalanceSheet(id, customer.name)}
                                            downloadingBalanceSheet={downloadingId === id}
                                        />
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            <CustomerAnalyticsTransactionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                context={dialogContext}
                onSuccess={() => {
                    void refetch()
                }}
            />
            <ConfirmDialog
                open={!!deleteTxnId}
                onOpenChange={() => setDeleteTxnId(null)}
                title="Delete transaction?"
                description="This removes the ledger row. Linked order payment or refund totals will be updated."
                onConfirm={async () => {
                    if (!deleteTxnId) return
                    try {
                        await deleteTxn(deleteTxnId).unwrap()
                        toast.success('Transaction deleted')
                        setDeleteTxnId(null)
                        void refetch()
                    } catch (err) {
                        toast.error(getApiErrorMessage(err, 'Could not delete transaction'))
                    }
                }}
                loading={deletingTxn}
            />
        </div>
    )
}

function CustomerRows({
    customer,
    expanded,
    canWrite,
    canDelete,
    colSpan,
    onToggle,
    onNewTransaction,
    onDeleteTxn,
    onDownloadBalanceSheet,
    downloadingBalanceSheet
}: {
    customer: CustomerAnalyticsRow
    expanded: boolean
    canWrite: boolean
    canDelete: boolean
    colSpan: number
    onToggle: () => void
    onNewTransaction: (context: CustomerAnalyticsTxnContext) => void
    onDeleteTxn: (id: string) => void
    onDownloadBalanceSheet: () => void
    downloadingBalanceSheet: boolean
}) {
    const id = customer.id ?? customer._id

    return (
        <>
            <TableRow
                className={cn('cursor-pointer', expanded && 'bg-muted/40')}
                onClick={onToggle}>
                <TableCell className="w-8">
                    <ChevronRight className={cn('text-muted-foreground size-4 transition-transform', expanded && 'rotate-90')} />
                </TableCell>
                <TableCell className="whitespace-normal">
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-muted-foreground text-xs">{customer.contact}</p>
                    <p className="text-muted-foreground max-w-xs truncate text-xs">{customer.address}</p>
                </TableCell>
                <TableCell>{customer.orderCount.toLocaleString()}</TableCell>
                <TableCell>{formatPkr(customer.totalIn)}</TableCell>
                <TableCell>{formatPkr(customer.totalOut)}</TableCell>
                <TableCell className={customer.netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                    {formatPkr(customer.netAmount)}
                </TableCell>
                {canWrite ? (
                    <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-1">
                            <BalanceSheetDownloadButton
                                loading={downloadingBalanceSheet}
                                onClick={onDownloadBalanceSheet}
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onNewTransaction({})}>
                                New transaction
                            </Button>
                        </div>
                    </TableCell>
                ) : (
                    <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}>
                        <BalanceSheetDownloadButton
                            loading={downloadingBalanceSheet}
                            onClick={onDownloadBalanceSheet}
                        />
                    </TableCell>
                )}
            </TableRow>
            {expanded ? (
                <TableRow className="hover:bg-transparent">
                    <TableCell
                        colSpan={colSpan}
                        className="bg-muted/20 whitespace-normal p-0">
                        <CustomerDetail
                            customerId={id}
                            canWrite={canWrite}
                            canDelete={canDelete}
                            onNewTransaction={onNewTransaction}
                            onDeleteTxn={onDeleteTxn}
                        />
                    </TableCell>
                </TableRow>
            ) : null}
        </>
    )
}
