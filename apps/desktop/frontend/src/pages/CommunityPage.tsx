import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isSuperAdmin, normalizeRole } from '@/lib/roles'
import { useDeleteUserMutation, useGetUsersQuery, useUpdateUserRoleMutation, useVerifyUserMutation } from '@/redux/api/usersApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import { toast } from 'sonner'

export default function CommunityPage() {
    const currentUser = useSelector(selectCurrentUser)
    const { data, isLoading, refetch } = useGetUsersQuery(undefined, { skip: !isSuperAdmin(currentUser?.role) })
    const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation()
    const [verifyUser] = useVerifyUserMutation()
    const [updateUserRole] = useUpdateUserRoleMutation()
    const [search, setSearch] = useState('')
    const [deleteId, setDeleteId] = useState<string | null>(null)

    if (!isSuperAdmin(currentUser?.role)) {
        return (
            <Navigate
                to="/"
                replace
            />
        )
    }

    const filtered = useMemo(() => {
        const list = data?.users ?? []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter((u) => u.name.toLowerCase().includes(q) || u.contact.toLowerCase().includes(q))
    }, [data, search])

    const currentUserId = currentUser?.id ?? currentUser?._id

    return (
        <div>
            <PageHeader
                title="Community"
                description="Verify users, assign admin roles, and manage accounts"
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
                    { key: 'contact', label: 'WhatsApp' },
                    {
                        key: 'role',
                        label: 'Role',
                        render: (row) => {
                            const userId = String(row.id ?? row._id)
                            const role = String(row.role ?? 'User')

                            if (normalizeRole(role) === 'super_admin') {
                                return <Badge>Super Admin</Badge>
                            }

                            return (
                                <Select
                                    value={normalizeRole(role) === 'admin' ? 'admin' : 'user'}
                                    onValueChange={async (value) => {
                                        try {
                                            await updateUserRole({ id: userId, role: value }).unwrap()
                                            toast.success('Role updated')
                                            refetch()
                                        } catch (err) {
                                            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Role update failed')
                                        }
                                    }}>
                                    <SelectTrigger className="h-8 w-[130px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            )
                        }
                    },
                    {
                        key: 'isVerified',
                        label: 'Verified',
                        render: (row) => <Badge variant={row.isVerified ? 'default' : 'secondary'}>{row.isVerified ? 'Yes' : 'No'}</Badge>
                    }
                ]}
                rows={filtered as unknown as Record<string, unknown>[]}
                renderActions={(row) => {
                    const userId = String(row.id ?? row._id)
                    const role = normalizeRole(String(row.role ?? ''))
                    const isSelf = userId === currentUserId
                    const canDelete = !isSelf && role !== 'super_admin'

                    return (
                        <RowActions
                            extra={
                                !row.isVerified && role !== 'super_admin' ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                await verifyUser(userId).unwrap()
                                                toast.success('User verified')
                                                refetch()
                                            } catch (err) {
                                                toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Verify failed')
                                            }
                                        }}>
                                        Verify
                                    </Button>
                                ) : null
                            }
                            onDelete={canDelete ? () => setDeleteId(userId) : undefined}
                        />
                    )
                }}
            />

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
                title="Delete user?"
                description="This user must have no orders, customers, transactions, or other linked records."
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
