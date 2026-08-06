import { useMemo, useState } from 'react'
import { RecordMiscExpenditureDialog } from '@/components/expenses/RecordMiscExpenditureDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { DateRangeFilter, isWithinDateRange } from '@/components/shared/DateRangeFilter'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteMiscExpenditureMutation, useGetMiscExpendituresQuery } from '@/redux/api/miscExpenditureApi'
import type { MiscellaneousExpenditure } from '@/types/api'
import { ExternalLink, Plus } from 'lucide-react'
import { toast } from 'sonner'

function formatDate(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleString()
}

export default function MiscellaneousExpenditurePage() {
    const { canWrite, canDelete } = usePermissions()
    const { data, isLoading, refetch } = useGetMiscExpendituresQuery()
    const [deleteExpenditure, { isLoading: deleting }] = useDeleteMiscExpenditureMutation()

    const [search, setSearch] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const expenditures = data?.expenditures ?? []

    const filtered = useMemo(() => {
        return expenditures.filter((item) => {
            if (!isWithinDateRange(item.createdAt, from, to)) return false
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return (
                item.note.toLowerCase().includes(q) ||
                item.paymentMode.toLowerCase().includes(q) ||
                (item.createdBy?.name ?? '').toLowerCase().includes(q)
            )
        })
    }, [expenditures, search, from, to])

    const totals = useMemo(() => {
        return filtered.reduce(
            (acc, item) => {
                acc.total += item.amount
                if (item.paymentMode === 'cash') acc.cash += item.amount
                else acc.online += item.amount
                return acc
            },
            { total: 0, cash: 0, online: 0 }
        )
    }, [filtered])

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            await deleteExpenditure(deleteId).unwrap()
            toast.success('Expenditure deleted')
            setDeleteId(null)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete expenditure'))
        }
    }

    return (
        <div>
            <PageHeader
                title="Miscellaneous expenditure"
                description="Track factory overheads and other expenses with payment mode and optional proof"
                actions={
                    canWrite ? (
                        <Button onClick={() => setFormOpen(true)}>
                            <Plus className="size-4" /> Record expenditure
                        </Button>
                    ) : null
                }
            />

            <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total shown</p>
                    <p className="text-2xl font-semibold">PKR {totals.total.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Cash</p>
                    <p className="text-2xl font-semibold">PKR {totals.cash.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Online</p>
                    <p className="text-2xl font-semibold">PKR {totals.online.toLocaleString()}</p>
                </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by note, payment mode, or recorder..."
                />
                <DateRangeFilter
                    from={from}
                    to={to}
                    onFromChange={setFrom}
                    onToChange={setTo}
                />
            </div>

            <DataTable
                loading={isLoading}
                columns={[
                    {
                        key: 'createdAt',
                        label: 'Date',
                        render: (row) => formatDate(String(row.createdAt ?? ''))
                    },
                    {
                        key: 'amount',
                        label: 'Amount (PKR)',
                        render: (row) => Number(row.amount).toLocaleString()
                    },
                    {
                        key: 'paymentMode',
                        label: 'Payment',
                        render: (row) => (
                            <Badge variant={row.paymentMode === 'online' ? 'default' : 'secondary'}>
                                {String(row.paymentMode) === 'online' ? 'Online' : 'Cash'}
                            </Badge>
                        )
                    },
                    {
                        key: 'note',
                        label: 'Note',
                        render: (row) => <span className="line-clamp-2 max-w-md">{String(row.note)}</span>
                    },
                    {
                        key: 'proofImage',
                        label: 'Proof',
                        render: (row) =>
                            row.proofImage ? (
                                <Button
                                    asChild
                                    variant="link"
                                    className="h-auto p-0">
                                    <a
                                        href={String(row.proofImage)}
                                        target="_blank"
                                        rel="noopener noreferrer">
                                        View
                                        <ExternalLink className="ml-1 size-3.5" />
                                    </a>
                                </Button>
                            ) : (
                                '—'
                            )
                    },
                    {
                        key: 'createdBy',
                        label: 'Recorded by',
                        render: (row) => {
                            const item = row as unknown as MiscellaneousExpenditure
                            return item.createdBy?.name ?? '—'
                        }
                    }
                ]}
                rows={filtered as unknown as Record<string, unknown>[]}
                renderActions={
                    canDelete
                        ? (row) => {
                              const item = row as unknown as MiscellaneousExpenditure
                              return <RowActions onDelete={() => setDeleteId(String(item.id ?? item._id))} />
                          }
                        : undefined
                }
            />

            <RecordMiscExpenditureDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                onSuccess={() => void refetch()}
            />

            <ConfirmDialog
                open={Boolean(deleteId)}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="Delete expenditure?"
                description="This permanently removes the record and its proof image from storage."
                loading={deleting}
                onConfirm={() => void handleDelete()}
            />
        </div>
    )
}
