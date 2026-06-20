import { useMemo, useState } from 'react'
import { UserFormDialog } from '@/components/users/UserFormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDeleteUserMutation, useGetUsersQuery, useVerifyUserMutation } from '@/redux/api/usersApi'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function CommunityPage() {
    const { data, isLoading, refetch } = useGetUsersQuery()
    const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation()
    const [verifyUser] = useVerifyUserMutation()
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const filtered = useMemo(() => {
        const list = data?.users ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }, [data, search])

    return (
        <div>
            <PageHeader
                title="Community"
                description="Manage users, roles, and verification"
                actions={
                    <Button onClick={() => setFormOpen(true)}>
                        <Plus className="size-4" /> Add User
                    </Button>
                }
            />

            <div className="mb-4">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search users..."
                />
            </div>

            <DataTable
                loading={isLoading}
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role' },
                    {
                        key: 'isVerified',
                        label: 'Verified',
                        render: (row) => <Badge variant={row.isVerified ? 'default' : 'secondary'}>{row.isVerified ? 'Yes' : 'No'}</Badge>
                    }
                ]}
                rows={filtered as unknown as Record<string, unknown>[]}
                renderActions={(row) => (
                    <RowActions
                        extra={
                            !row.isVerified ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        try {
                                            await verifyUser(String(row.id ?? row._id)).unwrap()
                                            toast.success('User verified')
                                            refetch()
                                        } catch {
                                            toast.error('Verify failed')
                                        }
                                    }}>
                                    Verify
                                </Button>
                            ) : null
                        }
                        onDelete={() => setDeleteId(String(row.id ?? row._id))}
                    />
                )}
            />

            <UserFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                onSuccess={() => {
                    setFormOpen(false)
                    refetch()
                }}
            />
            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
                title="Delete user?"
                onConfirm={async () => {
                    if (!deleteId) return
                    try {
                        await deleteUser(deleteId).unwrap()
                        toast.success('User deleted')
                        setDeleteId(null)
                        refetch()
                    } catch (err) {
                        toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Delete failed')
                    }
                }}
                loading={deleting}
            />
        </div>
    )
}
