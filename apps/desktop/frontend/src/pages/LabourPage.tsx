import { useState } from 'react'
import { LabourerFormDialog } from '@/components/labour/LabourerFormDialog'
import { LabourRatesDialog } from '@/components/labour/LabourRatesDialog'
import { RecordProductionDialog } from '@/components/labour/RecordProductionDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getApiErrorMessage } from '@/lib/errors'
import { isAdminOrAbove } from '@/lib/roles'
import { useGetLabourersQuery, useGetProductionEntriesQuery, useUpdateLabourerMutation } from '@/redux/api/labourApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import type { Labourer } from '@/types/api'
import { DollarSign, Plus } from 'lucide-react'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'

export default function LabourPage() {
    const user = useSelector(selectCurrentUser)
    const isAdmin = isAdminOrAbove(user?.role)
    const { data: labourersData, isLoading: loadingWorkers, refetch: refetchWorkers } = useGetLabourersQuery(true)
    const { data: productionData, isLoading: loadingProduction, refetch: refetchProduction } = useGetProductionEntriesQuery()
    const [updateLabourer] = useUpdateLabourerMutation()

    const [tab, setTab] = useState('workers')
    const [search, setSearch] = useState('')
    const [workerFormOpen, setWorkerFormOpen] = useState(false)
    const [ratesOpen, setRatesOpen] = useState(false)
    const [recordOpen, setRecordOpen] = useState(false)
    const [editWorker, setEditWorker] = useState<Labourer | null>(null)
    const [ratesWorker, setRatesWorker] = useState<Labourer | null>(null)

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
                description="Manage workers, pay rates per product, and record production that updates inventory"
                actions={
                    isAdmin ? (
                        <>
                            {tab === 'workers' ? (
                                <Button
                                    onClick={() => {
                                        setEditWorker(null)
                                        setWorkerFormOpen(true)
                                    }}>
                                    <Plus className="size-4" /> Add worker
                                </Button>
                            ) : (
                                <Button onClick={() => setRecordOpen(true)}>
                                    <Plus className="size-4" /> Record production
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
                </TabsList>

                <div className="mb-4">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder={tab === 'workers' ? 'Search workers...' : 'Search production entries...'}
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
                            isAdmin
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
                }}
            />
        </div>
    )
}
