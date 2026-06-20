import { useState } from 'react'
import { TargetFormDialog } from '@/components/users/UserFormDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { useCreateTargetMutation, useDeleteTargetMutation, useGetTargetsQuery } from '@/redux/api/usersApi'
import { useGetUsersQuery } from '@/redux/api/usersApi'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

export default function DashboardPage() {
    const { data, isLoading, refetch } = useGetTargetsQuery()
    const { data: usersData } = useGetUsersQuery()
    const [createTarget, { isLoading: creating }] = useCreateTargetMutation()
    const [deleteTarget, { isLoading: deleting }] = useDeleteTargetMutation()
    const [formOpen, setFormOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const users = (usersData?.users ?? []).map((u) => ({ id: u.id ?? u._id, name: u.name }))

    return (
        <div>
            <PageHeader
                title="Dashboard"
                description="Sales targets and team performance"
                actions={
                    <Button onClick={() => setFormOpen(true)}>
                        <Plus className="size-4" /> Add Target
                    </Button>
                }
            />

            <DataTable
                loading={isLoading}
                columns={[
                    {
                        key: 'userId',
                        label: 'User',
                        render: (row) => (row.userId as { name?: string })?.name ?? '—'
                    },
                    { key: 'type', label: 'Type' },
                    { key: 'value', label: 'Target' },
                    { key: 'progress', label: 'Progress' },
                    {
                        key: 'achieved',
                        label: 'Achieved',
                        render: (row) => (row.achieved ? 'Yes' : 'No')
                    }
                ]}
                rows={(data?.targets ?? []) as unknown as Record<string, unknown>[]}
                renderActions={(row) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteId(String(row.id ?? row._id))}>
                        Delete
                    </Button>
                )}
            />

            <TargetFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                users={users}
                loading={creating}
                onSubmit={async (payload) => {
                    try {
                        await createTarget(payload).unwrap()
                        toast.success('Target created')
                        setFormOpen(false)
                        refetch()
                    } catch (err) {
                        toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Create failed')
                    }
                }}
            />

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
                title="Delete target?"
                onConfirm={async () => {
                    if (!deleteId) return
                    try {
                        await deleteTarget(deleteId).unwrap()
                        toast.success('Target deleted')
                        setDeleteId(null)
                        refetch()
                    } catch {
                        toast.error('Delete failed')
                    }
                }}
                loading={deleting}
            />
        </div>
    )
}
