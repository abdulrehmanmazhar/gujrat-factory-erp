import { useEffect, useMemo, useState } from 'react'
import { LabourAnalyticsTransactionDialog, type LabourAnalyticsTxnContext } from '@/components/labour/LabourAnalyticsTransactionDialog'
import { LabourProductionDetailDialog } from '@/components/labour/LabourProductionDetailDialog'
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
import { useExportLabourBalanceSheetMutation, useGetLabourAnalyticsDetailQuery, useGetLabourAnalyticsQuery } from '@/redux/api/analyticsApi'
import { useDeleteLabourTransactionMutation } from '@/redux/api/labourApi'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { BalanceSheetDownloadButton } from '@/components/shared/BalanceSheetDownloadButton'
import { downloadBlob } from '@/lib/download'
import type { LabourAnalyticsProduction, LabourAnalyticsRow, LabourAnalyticsTransaction, LabourTransactionCategory } from '@/types/api'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, HardHat, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'

const PER_PAGE = 10

const CATEGORY_LABELS: Record<LabourTransactionCategory, string> = {
    production: 'Production',
    income: 'Income',
    advance: 'Advance',
    bonus: 'Bonus',
    expense: 'Expense',
    other: 'Other'
}

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

function txnCategory(row: LabourAnalyticsTransaction): LabourTransactionCategory {
    return (row.labourCategory ?? row.category) as LabourTransactionCategory
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
    rows: LabourAnalyticsTransaction[]
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
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Note</TableHead>
                        {canDelete ? <TableHead className="w-10" /> : null}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => {
                        const id = row.id ?? row._id
                        const category = txnCategory(row)
                        return (
                            <TableRow key={id}>
                                <TableCell>{formatDate(row.createdAt)}</TableCell>
                                <TableCell>
                                    <Badge variant={row.direction === 'in' ? 'default' : 'secondary'}>{row.direction === 'in' ? 'In' : 'Out'}</Badge>
                                </TableCell>
                                <TableCell>{CATEGORY_LABELS[category] ?? category}</TableCell>
                                <TableCell>{formatPkr(row.amount)}</TableCell>
                                <TableCell className="max-w-xs whitespace-normal">
                                    <span className="line-clamp-2">{row.description || '—'}</span>
                                </TableCell>
                                {canDelete ? (
                                    <TableCell>
                                        {category === 'production' ? null : (
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => onDelete?.(id)}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        )}
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

function ProductionRow({ entry }: { entry: LabourAnalyticsProduction }) {
    const [open, setOpen] = useState(false)
    const [viewOpen, setViewOpen] = useState(false)

    return (
        <div className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    onClick={() => setOpen((value) => !value)}>
                    <ChevronRight className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-90')} />
                    <span className="font-medium">{entry.product?.name ?? 'Production'}</span>
                    {entry.recipeApplied ? <Badge variant="outline">Recipe</Badge> : null}
                    <span className="text-muted-foreground hidden text-xs sm:inline">{formatDate(entry.createdAt)}</span>
                </button>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>Qty {entry.qtyProduced.toLocaleString()}</span>
                    <span>Rate {formatPkr(entry.ratePerUnit)}</span>
                    <span>Pay {formatPkr(entry.totalPay)}</span>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setViewOpen(true)}>
                    <Eye className="size-3.5" /> View
                </Button>
            </div>
            <LabourProductionDetailDialog
                open={viewOpen}
                onOpenChange={setViewOpen}
                entry={entry}
            />
            {open ? (
                <div className="space-y-3 border-t px-3 py-3">
                    {entry.notes ? <p className="text-muted-foreground text-sm">{entry.notes}</p> : null}
                    {(entry.consumption ?? []).length ? (
                        <div>
                            <p className="mb-1 text-sm font-medium">Materials used</p>
                            <ul className="text-muted-foreground space-y-0.5 text-sm">
                                {(entry.consumption ?? []).map((row) => (
                                    <li key={row.id}>
                                        {row.product?.name ?? row.productId}: {row.qtyConsumed}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    <div>
                        <p className="mb-1 text-sm font-medium">Production transaction</p>
                        <TransactionsTable
                            rows={entry.transactions}
                            emptyMessage="No production pay was recorded for this log (zero rate or unpaid)."
                        />
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function LabourerDetail({
    labourerId,
    canWrite,
    canDelete,
    onNewTransaction,
    onDeleteTxn
}: {
    labourerId: string
    canWrite: boolean
    canDelete: boolean
    onNewTransaction: (context: LabourAnalyticsTxnContext) => void
    onDeleteTxn: (id: string) => void
}) {
    const { data, isLoading, isError } = useGetLabourAnalyticsDetailQuery(labourerId)

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
        return <p className="text-destructive p-3 text-sm">Could not load production logs and transactions.</p>
    }

    return (
        <div className="space-y-5 p-3">
            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <HardHat className="size-4" /> Production logs
                    </h4>
                    {canWrite ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onNewTransaction({ labourerId, direction: 'in' })}>
                            New transaction In
                        </Button>
                    ) : null}
                </div>
                {data.productions.length ? (
                    <div className="space-y-2">
                        {data.productions.map((entry) => (
                            <ProductionRow
                                key={entry.id ?? entry._id}
                                entry={{ ...entry, labourer: entry.labourer ?? data.labourer }}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">No production logs for this worker.</p>
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
                                onClick={() => onNewTransaction({ labourerId, direction: 'in' })}>
                                <ArrowDownLeft className="size-3.5" /> In
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onNewTransaction({ labourerId, direction: 'out' })}>
                                <ArrowUpRight className="size-3.5" /> Out
                            </Button>
                        </div>
                    ) : null}
                </div>
                <TransactionsTable
                    rows={data.standaloneTransactions}
                    emptyMessage="No standalone transactions — production pay is shown on each production log"
                    canDelete={canDelete}
                    onDelete={onDeleteTxn}
                />
            </section>
        </div>
    )
}

export default function LabourAnalyticsPage() {
    const { canWrite, canDelete } = usePermissions()
    const [search, setSearch] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [page, setPage] = useState(1)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogContext, setDialogContext] = useState<LabourAnalyticsTxnContext | null>(null)
    const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null)
    const [downloadingId, setDownloadingId] = useState<string | null>(null)
    const [deleteTxn, { isLoading: deletingTxn }] = useDeleteLabourTransactionMutation()
    const [exportBalanceSheet] = useExportLabourBalanceSheetMutation()

    const { data, isLoading, refetch } = useGetLabourAnalyticsQuery({ from, to, q: search.trim() || undefined })

    useEffect(() => {
        setPage(1)
        setExpandedId(null)
    }, [search, from, to])

    const filtered = useMemo(() => {
        const list = data?.labourers ?? []
        if (search.trim()) return list
        if (from || to) {
            return list.filter(
                (labourer) => labourer.productionCount > 0 || labourer.totalIn > 0 || labourer.totalOut > 0 || labourer.totalProductionPay > 0
            )
        }
        return list
    }, [data, search, from, to])

    const summary = useMemo(
        () =>
            filtered.reduce(
                (acc, labourer) => {
                    acc.totalProductionPay += labourer.totalProductionPay
                    acc.productionCount += labourer.productionCount
                    acc.totalIn += labourer.totalIn
                    acc.totalOut += labourer.totalOut
                    return acc
                },
                { totalProductionPay: 0, productionCount: 0, totalIn: 0, totalOut: 0 }
            ),
        [filtered]
    )

    const rows = paginate(filtered, page, PER_PAGE)
    const colSpan = 8

    const handleDownloadBalanceSheet = async (id: string, name: string) => {
        try {
            setDownloadingId(id)
            const blob = await exportBalanceSheet({
                id,
                from: from || undefined,
                to: to || undefined,
                q: search.trim() || undefined
            }).unwrap()
            downloadBlob(blob, balanceSheetFilename('labour', name))
            toast.success('Balance sheet downloaded')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not download balance sheet'))
        } finally {
            setDownloadingId(null)
        }
    }

    const openDialog = (context: LabourAnalyticsTxnContext | null = null) => {
        setDialogContext(context)
        setDialogOpen(true)
    }

    return (
        <div>
            <PageHeader
                title="Labour analytics"
                description="Production pay, nested production logs, and In/Out history for every worker"
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
                    label="Total production pay"
                    value={formatPkr(summary.totalProductionPay)}
                    hint="Pay earned from production logs in the selected range"
                />
                <SummaryCard
                    label="Production logs"
                    value={summary.productionCount.toLocaleString()}
                    hint="Production entries in the selected range"
                />
                <SummaryCard
                    label="Total In"
                    value={formatPkr(summary.totalIn)}
                    hint="Production pay plus standalone income"
                />
                <SummaryCard
                    label="Total Out"
                    value={formatPkr(summary.totalOut)}
                    hint="Advances, bonuses, expenses, and other payouts"
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
                    placeholder="Search name, contact, product, or transaction notes…"
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
                                <TableHead>Worker</TableHead>
                                <TableHead>Logs</TableHead>
                                <TableHead>Production pay</TableHead>
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
                                        No workers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((labourer) => {
                                    const id = labourer.id ?? labourer._id
                                    return (
                                        <LabourerRows
                                            key={id}
                                            labourer={labourer}
                                            expanded={expandedId === id}
                                            canWrite={canWrite}
                                            canDelete={canDelete}
                                            colSpan={colSpan}
                                            onToggle={() => setExpandedId((current) => (current === id ? null : id))}
                                            onNewTransaction={(context) => openDialog({ labourerId: id, ...context })}
                                            onDeleteTxn={setDeleteTxnId}
                                            onDownloadBalanceSheet={() => void handleDownloadBalanceSheet(id, labourer.name)}
                                            downloadingBalanceSheet={downloadingId === id}
                                        />
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            <LabourAnalyticsTransactionDialog
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
                description="This removes the standalone labour ledger row. Production pay cannot be deleted here."
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

function LabourerRows({
    labourer,
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
    labourer: LabourAnalyticsRow
    expanded: boolean
    canWrite: boolean
    canDelete: boolean
    colSpan: number
    onToggle: () => void
    onNewTransaction: (context: LabourAnalyticsTxnContext) => void
    onDeleteTxn: (id: string) => void
    onDownloadBalanceSheet: () => void
    downloadingBalanceSheet: boolean
}) {
    const id = labourer.id ?? labourer._id

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
                        {labourer.name}
                        {labourer.isActive ? null : <span className="text-muted-foreground ml-1 text-xs">(inactive)</span>}
                    </p>
                    <p className="text-muted-foreground text-xs">{labourer.contact || '—'}</p>
                    {labourer.notes ? <p className="text-muted-foreground max-w-xs truncate text-xs">{labourer.notes}</p> : null}
                </TableCell>
                <TableCell>{labourer.productionCount.toLocaleString()}</TableCell>
                <TableCell>{formatPkr(labourer.totalProductionPay)}</TableCell>
                <TableCell>{formatPkr(labourer.totalIn)}</TableCell>
                <TableCell>{formatPkr(labourer.totalOut)}</TableCell>
                <TableCell className={labourer.netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                    {formatPkr(labourer.netAmount)}
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
                        <LabourerDetail
                            labourerId={id}
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
