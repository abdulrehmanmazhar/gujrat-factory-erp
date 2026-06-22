import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/errors'
import { useUpdatePasswordMutation, useUpdateProfileMutation } from '@/redux/api/authApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import { toast } from 'sonner'

export default function ProfilePage() {
    const user = useSelector(selectCurrentUser)
    const [updateProfile, { isLoading: savingProfile }] = useUpdateProfileMutation()
    const [updatePassword, { isLoading: savingPassword }] = useUpdatePasswordMutation()

    const [name, setName] = useState(user?.name ?? '')
    const [email, setEmail] = useState(user?.email ?? '')
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => {
        setName(user?.name ?? '')
        setEmail(user?.email ?? '')
    }, [user?.email, user?.name])

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await updateProfile({ name, email }).unwrap()
            toast.success('Profile updated')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Profile update failed'))
        }
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        try {
            await updatePassword({ oldPassword, newPassword }).unwrap()
            toast.success('Password updated')
            setOldPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Password update failed'))
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <PageHeader
                title="Profile"
                description="Manage your account details and password"
            />

            <Card>
                <CardHeader>
                    <CardTitle>Account details</CardTitle>
                    <CardDescription>Update your name and email address.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleProfileSubmit}
                        className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="profile-name">Full name</Label>
                            <Input
                                id="profile-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="profile-email">Email</Label>
                            <Input
                                id="profile-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="text-sm text-muted-foreground">Role: {user?.role ?? '—'}</div>
                        <Button
                            type="submit"
                            disabled={savingProfile}>
                            {savingProfile ? 'Saving...' : 'Save profile'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Change your password.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handlePasswordSubmit}
                        className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="old-password">Current password</Label>
                            <Input
                                id="old-password"
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm new password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={savingPassword}>
                            {savingPassword ? 'Updating...' : 'Update password'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
