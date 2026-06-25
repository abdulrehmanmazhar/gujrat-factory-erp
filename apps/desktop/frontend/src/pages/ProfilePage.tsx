import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { PageHeader } from '@/components/shared/PageHeader'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/errors'
import { isValidWhatsAppContact, WHATSAPP_NUMBER_HINT, formatDisplayContact } from '@/lib/phone'
import { useUpdateAvatarMutation, useUpdatePasswordMutation, useUpdateProfileMutation } from '@/redux/api/authApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import { toast } from 'sonner'

function userInitials(name?: string) {
    if (!name?.trim()) return '?'
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

export default function ProfilePage() {
    const user = useSelector(selectCurrentUser)
    const [updateProfile, { isLoading: savingProfile }] = useUpdateProfileMutation()
    const [updateAvatar, { isLoading: savingAvatar }] = useUpdateAvatarMutation()
    const [updatePassword, { isLoading: savingPassword }] = useUpdatePasswordMutation()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [name, setName] = useState(user?.name ?? '')
    const [contact, setContact] = useState(user?.contact ?? '')
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

    useEffect(() => {
        setName(user?.name ?? '')
        setContact(user?.contact ?? '')
    }, [user?.contact, user?.name])

    useEffect(() => {
        return () => {
            if (avatarPreview) URL.revokeObjectURL(avatarPreview)
        }
    }, [avatarPreview])

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValidWhatsAppContact(contact)) {
            toast.error(`Enter a valid WhatsApp number (${WHATSAPP_NUMBER_HINT})`)
            return
        }
        try {
            await updateProfile({ name, contact }).unwrap()
            toast.success('Profile updated')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Profile update failed'))
        }
    }

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Please choose an image file')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be 5 MB or smaller')
            return
        }

        const preview = URL.createObjectURL(file)
        setAvatarPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return preview
        })

        try {
            await updateAvatar(file).unwrap()
            toast.success('Avatar updated')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Avatar upload failed'))
            setAvatarPreview((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
            })
        } finally {
            e.target.value = ''
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

    const avatarSrc = avatarPreview ?? user?.avatar?.url

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <PageHeader
                title="Profile"
                description="Manage your account details and password"
            />

            <Card>
                <CardHeader>
                    <CardTitle>Profile photo</CardTitle>
                    <CardDescription>Upload a photo for your account.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <Avatar className="size-20">
                        <AvatarImage
                            src={avatarSrc}
                            alt={user?.name ?? 'Profile'}
                        />
                        <AvatarFallback className="text-lg">{userInitials(user?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarChange}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={savingAvatar}
                            onClick={() => fileInputRef.current?.click()}>
                            {savingAvatar ? 'Uploading...' : 'Change photo'}
                        </Button>
                        <p className="text-xs text-muted-foreground">JPG, PNG or WebP · max 5 MB</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Account details</CardTitle>
                    <CardDescription>Update your name and WhatsApp number.</CardDescription>
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
                            <Label htmlFor="profile-contact">WhatsApp number</Label>
                            <Input
                                id="profile-contact"
                                type="tel"
                                value={contact}
                                onChange={(e) => setContact(e.target.value)}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                {WHATSAPP_NUMBER_HINT}
                                {user?.contact ? ` · Current: ${formatDisplayContact(user.contact)}` : ''}
                            </p>
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
