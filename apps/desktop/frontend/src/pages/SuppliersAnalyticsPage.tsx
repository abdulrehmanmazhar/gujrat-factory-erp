import { useEffect, useMemo, useState } from 'react'
import { SupplierAnalyticsTransactionDialog, type SupplierAnalyticsTxnContext } from '@/components/suppliers/SupplierAnalyticsTransactionDialog'
import {
    RestockOrderDetailDialog,
    RestockPaymentDialog,
    RestockRefundDialog,
    hasReturnableItems,
    restockOutstanding,
    statusVariant
} from '@/components/suppliers/RestockOrderDialogs'
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
import { useExportSupplierBalanceSheetMutation, useGetSupplierAnalyticsDetailQuery, useGetSupplierAnalyticsQuery } from '@/redux/api/analyticsApi'
import { useDeleteSupplierTransactionMutation } from '@/redux/api/restockApi'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { BalanceSheetDownloadButton } from '@/components/shared/BalanceSheetDownloadButton'
import { downloadBlob } from '@/lib/download'
import type { RestockOrder, SupplierAnalyticsOrder, SupplierAnalyticsRow, SupplierAnalyticsTransaction } from '@/types/api'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, ClipboardList, ExternalLink, Eye, Trash2, Wallet } from 'lucide-react'
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
    if (type === 'purchase') return 'Goods received'
    if (type === 'return') return 'Goods returned'
    if (type === 'payment') return 'Payment to supplier'
    if (type === 'refund') return 'Standalone In / refund'
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
    rows: SupplierAnalyticsTransaction[]
    emptyMessage: string
    canDelete?: boolean
    onDelete?: (id: string) => void
}) {
    if (!rows.length) {
        return <p className="text-muted-foreground px-1 py-3 text-sm">{emptyMessage}</p>
    }

    return (
        <div className="bg-background rounded-lg border">
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

function RestockRow({
    order,
    canWrite,
    canDelete,
    onPay,
    onRefund,
    onDeleteTxn
}: {
    order: SupplierAnalyticsOrder
    canWrite: boolean
    canDelete: boolean
    onPay: () => void
    onRefund: () => void
    onDeleteTxn: (id: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [viewOpen, setViewOpen] = useState(false)
    const id = order.id ?? order._id
    const outstanding = order.outstanding ?? restockOutstanding(order)
    const canPay = order.status === 'received' && outstanding > 0
    const canRefund = order.status === 'received' && hasReturnableItems(order)

    return (
        <div className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    onClick={() => setOpen((value) => !value)}>
                    <ChevronRight className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-90')} />
                    <span className="font-medium">{order.referenceNumber || `Restock ${id.slice(0, 8)}`}</span>
                    <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                    <span className="text-muted-foreground hidden text-xs sm:inline">{formatDate(order.createdAt)}</span>
                </button>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>Total {formatPkr(order.totalAmount ?? 0)}</span>
                    <span>Paid {formatPkr(order.amountPaid ?? 0)}</span>
                    <span>Refunded {formatPkr(order.amountRefunded ?? 0)}</span>
                    <span>Due {formatPkr(outstanding)}</span>
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
                                onClick={onPay}>
                                <ArrowUpRight className="size-3.5" /> Pay
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canRefund}
                                onClick={onRefund}>
                                <ArrowDownLeft className="size-3.5" /> Refund
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>
            <RestockOrderDetailDialog
                open={viewOpen}
                onOpenChange={setViewOpen}
                order={order}
            />
            {open ? (
                <div className="space-y-2 border-t px-3 py-3">
                    <p className="text-sm font-medium">Restock transactions</p>
                    <TransactionsTable
                        rows={order.transactions}
                        emptyMessage="No transactions linked to this restock order"
                        canDelete={canDelete}
                        onDelete={onDeleteTxn}
                    />
                </div>
            ) : null}
        </div>
    )
}

function SupplierDetail({
    supplierId,
    canWrite,
    canDelete,
    onNewTransaction,
    onPayRestock,
    onRefundRestock,
    onDeleteTxn
}: {
    supplierId: string
    canWrite: boolean
    canDelete: boolean
    onNewTransaction: (context: SupplierAnalyticsTxnContext) => void
    onPayRestock: (order: RestockOrder) => void
    onRefundRestock: (order: RestockOrder) => void
    onDeleteTxn: (id: string) => void
}) {
    const { data, isLoading, isError } = useGetSupplierAnalyticsDetailQuery(supplierId)

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
        return <p className="text-destructive p-3 text-sm">Could not load supplier restock orders and transactions.</p>
    }

    return (
        <div className="space-y-5 p-3">
            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <ClipboardList className="size-4" /> Restock orders
                    </h4>
                    {canWrite ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onNewTransaction({ supplierId, restockOrderId: null })}>
                            New transaction
                        </Button>
                    ) : null}
                </div>
                {data.orders.length ? (
                    <div className="space-y-2">
                        {data.orders.map((order) => (
                            <RestockRow
                                key={order.id ?? order._id}
                                order={{ ...order, supplier: order.supplier ?? data.supplier }}
                                canWrite={canWrite}
                                canDelete={canDelete}
                                onPay={() => onPayRestock(order)}
                                onRefund={() => onRefundRestock(order)}
                                onDeleteTxn={onDeleteTxn}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">No restock orders for this supplier.</p>
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
                                onClick={() => onNewTransaction({ supplierId, restockOrderId: null, direction: 'in' })}>
                                <ArrowDownLeft className="size-3.5" /> In
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onNewTransaction({ supplierId, restockOrderId: null, direction: 'out' })}>
                                <ArrowUpRight className="size-3.5" /> Out
                            </Button>
                        </div>
                    ) : null}
                </div>
                <TransactionsTable
                    rows={data.standaloneTransactions}
                    emptyMessage="No standalone transactions — these are In/Out entries not linked to a restock order"
                    canDelete={canDelete}
                    onDelete={onDeleteTxn}
                />
            </section>
        </div>
    )
}

export default function SuppliersAnalyticsPage() {
    const { canWrite, canDelete } = usePermissions()
    const [search, setSearch] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [page, setPage] = useState(1)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogContext, setDialogContext] = useState<SupplierAnalyticsTxnContext | null>(null)
    const [payOrder, setPayOrder] = useState<RestockOrder | null>(null)
    const [refundOrder, setRefundOrder] = useState<RestockOrder | null>(null)
    const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null)
    const [downloadingId, setDownloadingId] = useState<string | null>(null)
    const [deleteTxn, { isLoading: deletingTxn }] = useDeleteSupplierTransactionMutation()
    const [exportBalanceSheet] = useExportSupplierBalanceSheetMutation()

    const { data, isLoading, refetch } = useGetSupplierAnalyticsQuery({ from, to, q: search.trim() || undefined })

    useEffect(() => {
        setPage(1)
        setExpandedId(null)
    }, [search, from, to])

    const filtered = useMemo(() => {
        const list = data?.suppliers ?? []
        if (search.trim()) return list
        if (from || to) {
            return list.filter((supplier) => supplier.orderCount > 0 || supplier.totalIn > 0 || supplier.totalOut > 0 || supplier.totalPurchases > 0)
        }
        return list
    }, [data, search, from, to])

    const summary = useMemo(() => {
        return filtered.reduce(
            (acc, supplier) => {
                acc.totalPurchases += supplier.totalPurchases
                acc.totalOrders += supplier.orderCount
                acc.totalIn += supplier.totalIn
                acc.totalOut += supplier.totalOut
                acc.restockOutstanding += supplier.restockOutstanding
                return acc
            },
            { totalPurchases: 0, totalOrders: 0, totalIn: 0, totalOut: 0, restockOutstanding: 0 }
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
            downloadBlob(blob, balanceSheetFilename('supplier', name))
            toast.success('Balance sheet downloaded')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not download balance sheet'))
        } finally {
            setDownloadingId(null)
        }
    }

    const openDialog = (context: SupplierAnalyticsTxnContext | null = null) => {
        setDialogContext(context)
        setDialogOpen(true)
    }

    const handleMoneySuccess = () => {
        void refetch()
        setPayOrder(null)
        setRefundOrder(null)
    }

    return (
        <div>
            <PageHeader
                title="Suppliers analytics"
                description="Purchases, restock orders, and nested In/Out history for every supplier"
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

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="Total purchases"
                    value={formatPkr(summary.totalPurchases)}
                    hint="Received restock totals in the selected range"
                />
                <SummaryCard
                    label="Total restock orders"
                    value={summary.totalOrders.toLocaleString()}
                    hint="Ordered, received, and cancelled in the selected range"
                />
                <SummaryCard
                    label="Restock outstanding"
                    value={formatPkr(summary.restockOutstanding)}
                    hint="Unpaid received restock orders"
                />
                <SummaryCard
                    label="Total In"
                    value={formatPkr(summary.totalIn)}
                    hint="Refunds received from suppliers"
                />
                <SummaryCard
                    label="Total Out"
                    value={formatPkr(summary.totalOut)}
                    hint="Payments made to suppliers"
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
                    placeholder="Search name, contact, restock #, or transaction notes…"
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
                                <TableHead>Supplier</TableHead>
                                <TableHead>Restocks</TableHead>
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
                                        No suppliers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((supplier) => {
                                    const id = supplier.id ?? supplier._id
                                    return (
                                        <SupplierRows
                                            key={id}
                                            supplier={supplier}
                                            expanded={expandedId === id}
                                            canWrite={canWrite}
                                            canDelete={canDelete}
                                            colSpan={colSpan}
                                            onToggle={() => setExpandedId((current) => (current === id ? null : id))}
                                            onNewTransaction={(context) => openDialog({ supplierId: id, ...context })}
                                            onPayRestock={setPayOrder}
                                            onRefundRestock={setRefundOrder}
                                            onDeleteTxn={setDeleteTxnId}
                                            onDownloadBalanceSheet={() => void handleDownloadBalanceSheet(id, supplier.name)}
                                            downloadingBalanceSheet={downloadingId === id}
                                        />
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            <SupplierAnalyticsTransactionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                context={dialogContext}
                onSuccess={() => {
                    void refetch()
                }}
            />
            <RestockPaymentDialog
                open={!!payOrder}
                onOpenChange={(open) => !open && setPayOrder(null)}
                order={payOrder}
                onSuccess={handleMoneySuccess}
            />
            <RestockRefundDialog
                open={!!refundOrder}
                onOpenChange={(open) => !open && setRefundOrder(null)}
                order={refundOrder}
                onSuccess={handleMoneySuccess}
            />
            <ConfirmDialog
                open={!!deleteTxnId}
                onOpenChange={() => setDeleteTxnId(null)}
                title="Delete transaction?"
                description="This removes the ledger row. Linked restock payment totals will be updated when applicable."
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

function SupplierRows({
    supplier,
    expanded,
    canWrite,
    canDelete,
    colSpan,
    onToggle,
    onNewTransaction,
    onPayRestock,
    onRefundRestock,
    onDeleteTxn,
    onDownloadBalanceSheet,
    downloadingBalanceSheet
}: {
    supplier: SupplierAnalyticsRow
    expanded: boolean
    canWrite: boolean
    canDelete: boolean
    colSpan: number
    onToggle: () => void
    onNewTransaction: (context: SupplierAnalyticsTxnContext) => void
    onPayRestock: (order: RestockOrder) => void
    onRefundRestock: (order: RestockOrder) => void
    onDeleteTxn: (id: string) => void
    onDownloadBalanceSheet: () => void
    downloadingBalanceSheet: boolean
}) {
    const id = supplier.id ?? supplier._id

    return (
        <>
            <TableRow
                className={cn('cursor-pointer', expanded && 'bg-muted/40')}
                onClick={onToggle}>
                <TableCell className="w-8">
                    <ChevronRight className={cn('text-muted-foreground size-4 transition-transform', expanded && 'rotate-90')} />
                </TableCell>
                <TableCell className="whitespace-normal">
                    <p className="font-medium">
                        {supplier.name}
                        {supplier.isActive ? null : <span className="text-muted-foreground ml-1 text-xs">(inactive)</span>}
                    </p>
                    <p className="text-muted-foreground text-xs">{supplier.contact}</p>
                    <p className="text-muted-foreground max-w-xs truncate text-xs">{supplier.businessName || supplier.address || '—'}</p>
                </TableCell>
                <TableCell>{supplier.orderCount.toLocaleString()}</TableCell>
                <TableCell>{formatPkr(supplier.totalIn)}</TableCell>
                <TableCell>{formatPkr(supplier.totalOut)}</TableCell>
                <TableCell className={supplier.netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                    {formatPkr(supplier.netAmount)}
                </TableCell>
                <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}>
                    <div className="flex flex-wrap justify-end gap-1">
                        <BalanceSheetDownloadButton
                            loading={downloadingBalanceSheet}
                            onClick={onDownloadBalanceSheet}
                        />
                        {canWrite ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onNewTransaction({})}>
                                New transaction
                            </Button>
                        ) : null}
                    </div>
                </TableCell>
            </TableRow>
            {expanded ? (
                <TableRow className="hover:bg-transparent">
                    <TableCell
                        colSpan={colSpan}
                        className="bg-muted/20 whitespace-normal p-0">
                        <SupplierDetail
                            supplierId={id}
                            canWrite={canWrite}
                            canDelete={canDelete}
                            onNewTransaction={onNewTransaction}
                            onPayRestock={onPayRestock}
                            onRefundRestock={onRefundRestock}
                            onDeleteTxn={onDeleteTxn}
                        />
                    </TableCell>
                </TableRow>
            ) : null}
        </>
    )
}
