import { useState } from 'react'
import { LabourerFormDialog } from '@/components/labour/LabourerFormDialog'
import { LabourRatesDialog } from '@/components/labour/LabourRatesDialog'
import { RecordLabourTransactionDialog } from '@/components/labour/RecordLabourTransactionDialog'
import { RecordProductionDialog } from '@/components/labour/RecordProductionDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'
import {
    useDeleteLabourTransactionMutation,
    useGetLabourersQuery,
    useGetLabourTransactionsQuery,
    useGetProductionEntriesQuery,
    useUpdateLabourerMutation
} from '@/redux/api/labourApi'
import type { Labourer, LabourTransactionCategory, LabourerTransaction } from '@/types/api'
import { DollarSign, Plus } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORY_LABELS: Record<LabourTransactionCategory, string> = {
    production: 'Production',
    advance: 'Advance',
    bonus: 'Bonus',
    expense: 'Expense',
    other: 'Other'
}

export default function LabourPage() {
    const { canWrite, canDelete: canDeleteRecords } = usePermissions()
    const { data: labourersData, isLoading: loadingWorkers, refetch: refetchWorkers } = useGetLabourersQuery(true)
    const { data: productionData, isLoading: loadingProduction, refetch: refetchProduction } = useGetProductionEntriesQuery()
    const { data: transactionsData, isLoading: loadingTransactions, refetch: refetchTransactions } = useGetLabourTransactionsQuery()
    const [deleteTransaction, { isLoading: deletingTxn }] = useDeleteLabourTransactionMutation()
    const [updateLabourer] = useUpdateLabourerMutation()

    const [tab, setTab] = useState('workers')
    const [search, setSearch] = useState('')
    const [workerFormOpen, setWorkerFormOpen] = useState(false)
    const [ratesOpen, setRatesOpen] = useState(false)
    const [recordOpen, setRecordOpen] = useState(false)
    const [txnOpen, setTxnOpen] = useState(false)
    const [editWorker, setEditWorker] = useState<Labourer | null>(null)
    const [ratesWorker, setRatesWorker] = useState<Labourer | null>(null)
    const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null)

    const workers = labourersData?.labourers ?? []
    const filteredWorkers = workers.filter((l) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
            l.name.toLowerCase().includes(q) ||
            (l.contact ?? '').toLowerCase().includes(q) ||
            (l.rates ?? []).some((r) => r.product?.name?.toLowerCase().includes(q))
        )
    })

    const entries = productionData?.entries ?? []
    const filteredEntries = entries.filter((e) => {
        if (!search.trim() || tab !== 'production') return true
        const q = search.toLowerCase()
        return e.labourer?.name?.toLowerCase().includes(q) || e.product?.name?.toLowerCase().includes(q) || (e.notes ?? '').toLowerCase().includes(q)
    })

    const txns = transactionsData?.transactions ?? []
    const filteredTxns = txns.filter((t) => {
        if (!search.trim() || tab !== 'transactions') return true
        const q = search.toLowerCase()
        return (
            t.labourer?.name?.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            (t.labourCategory ?? '').toLowerCase().includes(q)
        )
    })

    const handleToggleActive = async (worker: Labourer) => {
        try {
            await updateLabourer({
                id: worker.id ?? worker._id,
                isActive: !worker.isActive
            }).unwrap()
            toast.success(worker.isActive ? 'Worker deactivated' : 'Worker reactivated')
            refetchWorkers()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Update failed'))
        }
    }

    return (
        <div>
            <PageHeader
                title="Labour"
                description="Manage workers, pay rates, production, and labour payments or expenses"
                actions={
                    canWrite ? (
                        <>
                            {tab === 'workers' ? (
                                <Button
                                    onClick={() => {
                                        setEditWorker(null)
                                        setWorkerFormOpen(true)
                                    }}>
                                    <Plus className="size-4" /> Add worker
                                </Button>
                            ) : tab === 'production' ? (
                                <Button onClick={() => setRecordOpen(true)}>
                                    <Plus className="size-4" /> Record production
                                </Button>
                            ) : (
                                <Button onClick={() => setTxnOpen(true)}>
                                    <Plus className="size-4" /> Record payment
                                </Button>
                            )}
                        </>
                    ) : null
                }
            />

            <Tabs
                value={tab}
                onValueChange={setTab}
                className="space-y-4">
                <TabsList>
                    <TabsTrigger value="workers">Workers</TabsTrigger>
                    <TabsTrigger value="production">Production history</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <div className="mb-4">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder={
                            tab === 'workers' ? 'Search workers...' : tab === 'production' ? 'Search production entries...' : 'Search transactions...'
                        }
                    />
                </div>

                <TabsContent value="workers">
                    <DataTable
                        loading={loadingWorkers}
                        columns={[
                            { key: 'name', label: 'Name' },
                            {
                                key: 'contact',
                                label: 'Contact',
                                render: (row) => String(row.contact ?? '—')
                            },
                            {
                                key: 'rates',
                                label: 'Rates',
                                render: (row) => {
                                    const rates = (row.rates as Labourer['rates']) ?? []
                                    return rates.length ? rates.map((r) => `${r.product?.name ?? '?'}: ${r.ratePerUnit}`).join(', ') : '—'
                                }
                            },
                            {
                                key: 'isActive',
                                label: 'Status',
                                render: (row) => (
                                    <Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                                )
                            }
                        ]}
                        rows={filteredWorkers as unknown as Record<string, unknown>[]}
                        renderActions={
                            canWrite
                                ? (row) => {
                                      const worker = row as unknown as Labourer
                                      return (
                                          <RowActions
                                              onEdit={() => {
                                                  setEditWorker(worker)
                                                  setWorkerFormOpen(true)
                                              }}
                                              deleteLabel={worker.isActive ? 'Deactivate' : 'Activate'}
                                              onDelete={() => handleToggleActive(worker)}
                                              extra={
                                                  <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => {
                                                          setRatesWorker(worker)
                                                          setRatesOpen(true)
                                                      }}>
                                                      <DollarSign className="mr-1 size-4" />
                                                      Rates
                                                  </Button>
                                              }
                                          />
                                      )
                                  }
                                : undefined
                        }
                    />
                </TabsContent>

                <TabsContent value="production">
                    <DataTable
                        loading={loadingProduction}
                        columns={[
                            {
                                key: 'createdAt',
                                label: 'Date',
                                render: (row) => (row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : '—')
                            },
                            {
                                key: 'labourer',
                                label: 'Worker',
                                render: (row) => (row.labourer as { name?: string })?.name ?? '—'
                            },
                            {
                                key: 'product',
                                label: 'Product',
                                render: (row) => (row.product as { name?: string })?.name ?? '—'
                            },
                            { key: 'qtyProduced', label: 'Qty' },
                            {
                                key: 'totalPay',
                                label: 'Pay (PKR)',
                                render: (row) => Number(row.totalPay ?? 0).toFixed(0)
                            },
                            {
                                key: 'recipeApplied',
                                label: 'Recipe',
                                render: (row) => (
                                    <Badge variant={row.recipeApplied ? 'default' : 'outline'}>{row.recipeApplied ? 'Applied' : 'None'}</Badge>
                                )
                            },
                            { key: 'notes', label: 'Notes', render: (row) => String(row.notes ?? '—') }
                        ]}
                        rows={filteredEntries as unknown as Record<string, unknown>[]}
                    />
                </TabsContent>

                <TabsContent value="transactions">
                    <DataTable
                        loading={loadingTransactions}
                        columns={[
                            {
                                key: 'createdAt',
                                label: 'Date',
                                render: (row) => (row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : '—')
                            },
                            {
                                key: 'labourer',
                                label: 'Worker',
                                render: (row) => (row.labourer as { name?: string })?.name ?? '—'
                            },
                            {
                                key: 'labourCategory',
                                label: 'Category',
                                render: (row) => {
                                    const cat = (row.labourCategory ?? row.category) as LabourTransactionCategory | null | undefined
                                    return (
                                        <Badge variant={cat === 'production' ? 'default' : 'secondary'}>
                                            {cat ? CATEGORY_LABELS[cat] : 'Labour'}
                                        </Badge>
                                    )
                                }
                            },
                            {
                                key: 'amount',
                                label: 'Amount (PKR)',
                                render: (row) => Number(row.amount ?? 0).toFixed(0)
                            },
                            { key: 'description', label: 'Description' }
                        ]}
                        rows={filteredTxns as unknown as Record<string, unknown>[]}
                        renderActions={
                            canWrite
                                ? (row) => {
                                      const txn = row as unknown as LabourerTransaction
                                      const category = txn.labourCategory ?? txn.category
                                      const canDeleteTxn = canDeleteRecords && category && category !== 'production'
                                      if (!canDeleteTxn) return null
                                      return (
                                          <RowActions
                                              onDelete={() => setDeleteTxnId(String(txn.id ?? txn._id))}
                                              deleteLabel="Delete"
                                          />
                                      )
                                  }
                                : undefined
                        }
                    />
                </TabsContent>
            </Tabs>

            <LabourerFormDialog
                open={workerFormOpen}
                onOpenChange={setWorkerFormOpen}
                labourer={editWorker}
                onSuccess={refetchWorkers}
            />

            <LabourRatesDialog
                open={ratesOpen}
                onOpenChange={setRatesOpen}
                labourer={ratesWorker}
                onSuccess={refetchWorkers}
            />

            <RecordProductionDialog
                open={recordOpen}
                onOpenChange={setRecordOpen}
                onSuccess={() => {
                    refetchProduction()
                    refetchWorkers()
                    refetchTransactions()
                }}
            />

            <RecordLabourTransactionDialog
                open={txnOpen}
                onOpenChange={setTxnOpen}
                onSuccess={refetchTransactions}
            />

            <ConfirmDialog
                open={!!deleteTxnId}
                onOpenChange={() => setDeleteTxnId(null)}
                title="Delete labour transaction?"
                description="This only removes the payment record. It does not reverse inventory changes."
                onConfirm={async () => {
                    if (!deleteTxnId) return
                    try {
                        await deleteTransaction(deleteTxnId).unwrap()
                        toast.success('Transaction deleted')
                        setDeleteTxnId(null)
                        refetchTransactions()
                    } catch (err) {
                        toast.error(getApiErrorMessage(err, 'Delete failed'))
                    }
                }}
                loading={deletingTxn}
            />
        </div>
    )
}
