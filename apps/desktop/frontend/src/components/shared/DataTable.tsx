import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export function DataTable({
    columns,
    rows,
    loading,
    emptyMessage = 'No records found',
    renderActions,
    selectable,
    selectedIds,
    onToggleRow,
    onToggleAll
}: {
    columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]
    rows: Record<string, unknown>[]
    loading?: boolean
    emptyMessage?: string
    renderActions?: (row: Record<string, unknown>) => React.ReactNode
    selectable?: boolean
    selectedIds?: Set<string>
    onToggleRow?: (id: string) => void
    onToggleAll?: () => void
}) {
    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                        key={i}
                        className="h-10 w-full"
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
                        {selectable ? (
                            <TableHead className="w-10">
                                <input
                                    type="checkbox"
                                    checked={rows.length > 0 && selectedIds?.size === rows.length}
                                    onChange={() => onToggleAll?.()}
                                />
                            </TableHead>
                        ) : null}
                        {columns.map((col) => (
                            <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                        {renderActions ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length + (selectable ? 1 : 0) + (renderActions ? 1 : 0)}
                                className="text-center text-muted-foreground">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        rows.map((row) => {
                            const rowId = String(row.id ?? row._id)
                            return (
                                <TableRow key={rowId}>
                                    {selectable ? (
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds?.has(rowId)}
                                                onChange={() => onToggleRow?.(rowId)}
                                            />
                                        </TableCell>
                                    ) : null}
                                    {columns.map((col) => (
                                        <TableCell key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '—')}</TableCell>
                                    ))}
                                    {renderActions ? <TableCell className="text-right">{renderActions(row)}</TableCell> : null}
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
