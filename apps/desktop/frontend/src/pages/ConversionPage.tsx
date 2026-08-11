import { useMemo, useState } from 'react'
import { ConversionFormDialog } from '@/components/conversions/ConversionFormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'
import { useGetConversionsQuery, useUndoConversionMutation } from '@/redux/api/conversionsApi'
import type { ProductConversion } from '@/types/api'
import { ArrowRightLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function ConversionPage() {
    const { canWrite, canDelete } = usePermissions()
    const { data, isLoading, refetch } = useGetConversionsQuery()
    const [undoConversion, { isLoading: undoing }] = useUndoConversionMutation()
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [undoId, setUndoId] = useState<string | null>(null)

    const filtered = useMemo(() => {
        const list = data?.conversions ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter(
            (c) =>
                c.inputProduct?.name?.toLowerCase().includes(q) ||
                c.outputProduct?.name?.toLowerCase().includes(q) ||
                (c.notes ?? '').toLowerCase().includes(q)
        )
    }, [data, search])

    const handleUndo = async () => {
        if (!undoId) return
        try {
            await undoConversion(undoId).unwrap()
            toast.success('Conversion undone')
            setUndoId(null)
            refetch()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not undo conversion'))
        }
    }

    return (
        <div>
            <PageHeader
                title="Conversion"
                description="Convert one inventory item into another using a one-to-one unit relation"
                actions={
                    canWrite ? (
                        <Button onClick={() => setFormOpen(true)}>
                            <Plus className="size-4" /> New conversion
                        </Button>
                    ) : undefined
                }
            />

            <div className="mb-4">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search conversions..."
                />
            </div>

            <DataTable
                loading={isLoading}
                columns={[
                    {
                        key: 'inputProduct',
                        label: 'From',
                        render: (row) => {
                            const c = row as unknown as ProductConversion
                            return `${c.inputProduct?.name ?? '—'} (−${c.inputQty})`
                        }
                    },
                    {
                        key: 'relation',
                        label: 'Relation',
                        render: (row) => {
                            const c = row as unknown as ProductConversion
                            return (
                                <span className="inline-flex items-center gap-1.5">
                                    {c.inputRatio}
                                    <ArrowRightLeft className="size-3.5 opacity-60" />
                                    {c.outputRatio}
                                </span>
                            )
                        }
                    },
                    {
                        key: 'outputProduct',
                        label: 'To',
                        render: (row) => {
                            const c = row as unknown as ProductConversion
                            return `${c.outputProduct?.name ?? '—'} (+${c.outputQty})`
                        }
                    },
                    {
                        key: 'createdByUser',
                        label: 'By',
                        render: (row) => (row.createdByUser as { name?: string })?.name ?? '—'
                    },
                    {
                        key: 'createdAt',
                        label: 'When',
                        render: (row) => {
                            const value = row.createdAt
                            if (!value) return '—'
                            return new Date(String(value)).toLocaleString()
                        }
                    },
                    {
                        key: 'notes',
                        label: 'Notes',
                        render: (row) => String(row.notes ?? '—')
                    }
                ]}
                rows={filtered as unknown as Record<string, unknown>[]}
                renderActions={
                    canDelete
                        ? (row) => (
                              <RowActions
                                  deleteLabel="Undo"
                                  onDelete={() => setUndoId(String(row.id ?? row._id))}
                              />
                          )
                        : undefined
                }
            />

            <ConversionFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                onSuccess={() => refetch()}
            />

            <ConfirmDialog
                open={!!undoId}
                onOpenChange={() => setUndoId(null)}
                title="Undo conversion?"
                description="This restores the input stock and removes the output stock that was added. The conversion record will be deleted."
                onConfirm={handleUndo}
                loading={undoing}
            />
        </div>
    )
}
