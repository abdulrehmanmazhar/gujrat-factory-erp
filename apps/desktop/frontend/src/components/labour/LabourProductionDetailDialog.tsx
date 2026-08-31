import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { LabourAnalyticsProduction, LabourTransactionCategory } from '@/types/api'

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

function formatDate(value?: string) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

export function LabourProductionDetailDialog({
    open,
    onOpenChange,
    entry
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    entry: LabourAnalyticsProduction | null
}) {
    if (!entry) return null

    const consumption = entry.consumption ?? []
    const transactions = entry.transactions ?? []

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Production log
                        {entry.recipeApplied ? <Badge variant="outline">Recipe applied</Badge> : <Badge variant="secondary">No recipe</Badge>}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <p>
                            <span className="text-muted-foreground">Worker:</span> {entry.labourer?.name ?? '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Product:</span> {entry.product?.name ?? '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Qty produced:</span> {entry.qtyProduced.toLocaleString()}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Rate:</span> {formatPkr(entry.ratePerUnit)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Pay:</span> {formatPkr(entry.totalPay)}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Date:</span> {formatDate(entry.createdAt)}
                        </p>
                    </div>
                    {entry.notes ? (
                        <p>
                            <span className="text-muted-foreground">Notes:</span> {entry.notes}
                        </p>
                    ) : null}

                    <div>
                        <p className="mb-2 font-medium">Materials used</p>
                        {consumption.length ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Qty consumed</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {consumption.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell>{row.product?.name ?? row.productId}</TableCell>
                                            <TableCell>{row.qtyConsumed}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-muted-foreground">No materials were consumed for this log.</p>
                        )}
                    </div>

                    <div>
                        <p className="mb-2 font-medium">Production pay</p>
                        {transactions.length ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Note</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((row) => {
                                        const category = (row.labourCategory ?? row.category) as LabourTransactionCategory
                                        return (
                                            <TableRow key={row.id ?? row._id}>
                                                <TableCell>{formatDate(row.createdAt)}</TableCell>
                                                <TableCell>{CATEGORY_LABELS[category] ?? category}</TableCell>
                                                <TableCell>{formatPkr(row.amount)}</TableCell>
                                                <TableCell className="max-w-xs whitespace-normal">{row.description || '—'}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-muted-foreground">No production pay was recorded for this log (zero rate or unpaid).</p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
