import { useMemo, useState } from 'react'
import { KhataTransactionDialog } from '@/components/khata/KhataTransactionDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { DateRangeFilter, isWithinDateRange } from '@/components/shared/DateRangeFilter'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteKhataEntryMutation, useGetCustomerKhataQuery, useGetSupplierKhataQuery } from '@/redux/api/khataApi'
import type { KhataDirection, KhataEntry, KhataParty } from '@/types/api'
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

function formatDate(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleString()
}

export default function KhataPage() {
    const { canWrite, canDelete } = usePermissions()
    const { data: customerData, isLoading: loadingCustomers, refetch: refetchCustomers } = useGetCustomerKhataQuery()
    const { data: supplierData, isLoading: loadingSuppliers, refetch: refetchSuppliers } = useGetSupplierKhataQuery()
    const [deleteEntry, { isLoading: deleting }] = useDeleteKhataEntryMutation()

    const [tab, setTab] = useState<'customers' | 'suppliers'>('customers')
    const [search, setSearch] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogParty, setDialogParty] = useState<KhataParty>('customer')
    const [dialogDirection, setDialogDirection] = useState<KhataDirection>('in')
    const [deleteTarget, setDeleteTarget] = useState<{ party: KhataParty; id: string } | null>(null)

    const customerEntries = customerData?.entries ?? []
    const supplierEntries = supplierData?.entries ?? []
    const entries = tab === 'customers' ? customerEntries : supplierEntries
    const isLoading = tab === 'customers' ? loadingCustomers : loadingSuppliers

    const filtered = useMemo(() => {
        return entries.filter((item) => {
            if (!isWithinDateRange(item.createdAt, from, to)) return false
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return (
                item.partyName.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                (item.paymentMode ?? '').toLowerCase().includes(q) ||
                item.direction.toLowerCase().includes(q)
            )
        })
    }, [entries, search, from, to])

    const totals = useMemo(() => {
        return filtered.reduce(
            (acc, item) => {
                if (item.direction === 'in') acc.totalIn += item.amount
                else acc.totalOut += item.amount
                return acc
            },
            { totalIn: 0, totalOut: 0 }
        )
    }, [filtered])

    const openDialog = (party: KhataParty, direction: KhataDirection) => {
        setDialogParty(party)
        setDialogDirection(direction)
        setDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteEntry(deleteTarget).unwrap()
            toast.success('Khata entry deleted')
            setDeleteTarget(null)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete Khata entry'))
        }
    }

    const renderTable = (rows: KhataEntry[], party: KhataParty) => (
        <DataTable
            loading={isLoading}
            columns={[
                {
                    key: 'createdAt',
                    label: 'Date',
                    render: (row) => formatDate(String(row.createdAt ?? ''))
                },
                {
                    key: 'partyName',
                    label: party === 'customer' ? 'Customer' : 'Supplier',
                    render: (row) => String(row.partyName ?? '—')
                },
                {
                    key: 'direction',
                    label: 'Direction',
                    render: (row) => <Badge variant={row.direction === 'in' ? 'default' : 'secondary'}>{row.direction === 'in' ? 'In' : 'Out'}</Badge>
                },
                {
                    key: 'amount',
                    label: 'Amount',
                    render: (row) => `PKR ${Number(row.amount ?? 0).toLocaleString()}`
                },
                {
                    key: 'paymentMode',
                    label: 'Mode',
                    render: (row) => String(row.paymentMode ?? '—')
                },
                {
                    key: 'description',
                    label: 'Note',
                    render: (row) => <span className="line-clamp-2 max-w-md">{String(row.description ?? '—')}</span>
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
                    key: 'balanceImpact',
                    label: 'Balance',
                    render: (row) => String(row.balanceImpact ?? '—')
                }
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
            emptyMessage="No Khata entries found"
            renderActions={
                canDelete
                    ? (row) => {
                          const item = row as unknown as KhataEntry
                          return (
                              <RowActions
                                  onDelete={() =>
                                      setDeleteTarget({
                                          party,
                                          id: String(item.id ?? item._id)
                                      })
                                  }
                              />
                          )
                      }
                    : undefined
            }
        />
    )

    return (
        <div>
            <PageHeader
                title="Khata"
                description="Standalone money In/Out with customers and suppliers (outside orders and restock)"
                actions={
                    canWrite ? (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={() => openDialog(tab === 'customers' ? 'customer' : 'supplier', 'in')}>
                                <ArrowDownLeft className="size-4" /> Transaction In
                            </Button>
                            <Button onClick={() => openDialog(tab === 'customers' ? 'customer' : 'supplier', 'out')}>
                                <ArrowUpRight className="size-4" /> Transaction Out
                            </Button>
                        </div>
                    ) : null
                }
            />

            <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total In</p>
                    <p className="text-2xl font-semibold">PKR {totals.totalIn.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total Out</p>
                    <p className="text-2xl font-semibold">PKR {totals.totalOut.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Net</p>
                    <p className="text-2xl font-semibold">PKR {(totals.totalIn - totals.totalOut).toLocaleString()}</p>
                </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by party, note, mode..."
                />
                <DateRangeFilter
                    from={from}
                    to={to}
                    onFromChange={setFrom}
                    onToChange={setTo}
                />
            </div>

            <Tabs
                value={tab}
                onValueChange={(value) => setTab(value as 'customers' | 'suppliers')}>
                <TabsList>
                    <TabsTrigger value="customers">Customers</TabsTrigger>
                    <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                </TabsList>
                <TabsContent
                    value="customers"
                    className="mt-4">
                    {renderTable(filtered, 'customer')}
                </TabsContent>
                <TabsContent
                    value="suppliers"
                    className="mt-4">
                    {renderTable(filtered, 'supplier')}
                </TabsContent>
            </Tabs>

            <KhataTransactionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                party={dialogParty}
                direction={dialogDirection}
                onSuccess={() => {
                    refetchCustomers()
                    refetchSuppliers()
                }}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete Khata entry?"
                description="This reverses the balance impact and permanently deletes the entry."
                loading={deleting}
                onConfirm={() => void handleDelete()}
            />
        </div>
    )
}
