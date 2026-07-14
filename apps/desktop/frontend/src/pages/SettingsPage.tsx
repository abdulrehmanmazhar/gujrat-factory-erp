import { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import constants from '@/constants/app'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'
import { isSuperAdmin } from '@/lib/roles'
import type { AppLanguage } from '@/lib/i18n-storage'
import { restartAppForPendingRestore } from '@/lib/server'
import { downloadBackupFile, useRestoreBackupMutation } from '@/redux/api/backupApi'
import { selectCurrentUser, selectAuthToken } from '@/redux/slices/authSlice'
import { Link } from 'react-router-dom'
import { ArchiveRestore, Database, Languages, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()
    const { t, uiLanguage, documentLanguage, setUiLanguage, setDocumentLanguage, format } = useLanguage()
    const user = useSelector(selectCurrentUser)
    const token = useSelector(selectAuthToken)
    const [restoreBackup, { isLoading: restoring }] = useRestoreBackupMutation()
    const [downloading, setDownloading] = useState(false)
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
    const [selectedBackup, setSelectedBackup] = useState<File | null>(null)
    const [savingLanguage, setSavingLanguage] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const canManageBackup = isSuperAdmin(user?.role)
    const { canWrite } = usePermissions()

    const languageOptions: { value: AppLanguage; label: string }[] = [
        { value: 'en', label: t.settings.english },
        { value: 'ur', label: t.settings.urdu }
    ]

    const handleUiLanguageChange = (value: AppLanguage) => {
        setUiLanguage(value)
    }

    const handleDocumentLanguageChange = async (value: AppLanguage) => {
        setSavingLanguage(true)
        try {
            await setDocumentLanguage(value)
            toast.success(t.settings.languageSaved)
        } catch (err) {
            toast.error(getApiErrorMessage(err, t.settings.languageSaveFailed))
        } finally {
            setSavingLanguage(false)
        }
    }

    const handleDownloadBackup = async () => {
        setDownloading(true)
        try {
            const fileName = await downloadBackupFile(() => token)
            toast.success(format(t.settings.backupDownloaded, { fileName }))
        } catch (err) {
            toast.error(getApiErrorMessage(err, t.settings.backupDownloadFailed))
        } finally {
            setDownloading(false)
        }
    }

    const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.toLowerCase().endsWith('.bak')) {
            toast.error(t.settings.chooseBakFile)
            e.target.value = ''
            return
        }

        setSelectedBackup(file)
        setRestoreDialogOpen(true)
        e.target.value = ''
    }

    const handleConfirmRestore = async () => {
        if (!selectedBackup) return

        try {
            const result = await restoreBackup(selectedBackup).unwrap()
            setRestoreDialogOpen(false)
            setSelectedBackup(null)
            toast.success(t.settings.backupStaged, {
                description: result.requiresRestart ? t.settings.backupStagedDesc : undefined,
                duration: 8000
            })

            if (result.requiresRestart) {
                window.setTimeout(() => {
                    void restartAppForPendingRestore()
                }, 1200)
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, t.settings.restoreFailed))
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t.settings.title}
                description={t.settings.description}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Languages className="size-5" />
                        {t.settings.language}
                    </CardTitle>
                    <CardDescription>{t.settings.languageDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <Label>{t.settings.uiLanguage}</Label>
                            <p className="text-sm text-muted-foreground">{t.settings.uiLanguageDesc}</p>
                        </div>
                        <Select
                            value={uiLanguage}
                            onValueChange={(value) => handleUiLanguageChange(value as AppLanguage)}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {languageOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <Label>{t.settings.documentLanguage}</Label>
                            <p className="text-sm text-muted-foreground">{t.settings.documentLanguageDesc}</p>
                        </div>
                        <Select
                            value={documentLanguage}
                            disabled={!canWrite || savingLanguage}
                            onValueChange={(value) => handleDocumentLanguageChange(value as AppLanguage)}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {languageOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t.settings.appearance}</CardTitle>
                    <CardDescription>{format(t.settings.appearanceDesc, { name: constants.NAME })}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <Label htmlFor="dark-mode">{t.settings.darkMode}</Label>
                    <Switch
                        id="dark-mode"
                        checked={theme === 'dark'}
                        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    />
                </CardContent>
            </Card>

            {canManageBackup ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="size-5" />
                            {t.settings.backupRestore}
                        </CardTitle>
                        <CardDescription>{t.settings.backupRestoreDesc}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="button"
                                onClick={handleDownloadBackup}
                                disabled={downloading}>
                                {downloading ? t.settings.creatingBackup : t.settings.downloadBackup}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={restoring}
                                onClick={() => fileInputRef.current?.click()}>
                                <ArchiveRestore className="mr-2 size-4" />
                                {restoring ? t.settings.restoring : t.settings.restoreFromBackup}
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".bak"
                                className="hidden"
                                onChange={handleBackupFileChange}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">{t.settings.backupNote}</p>
                    </CardContent>
                </Card>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="size-5" />
                        {t.settings.whatsapp}
                    </CardTitle>
                    <CardDescription>{t.settings.whatsappDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link to="/whatsapp">{t.settings.openWhatsapp}</Link>
                    </Button>
                </CardContent>
            </Card>

            <Dialog
                open={restoreDialogOpen}
                onOpenChange={(open) => {
                    setRestoreDialogOpen(open)
                    if (!open) setSelectedBackup(null)
                }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t.settings.restoreTitle}</DialogTitle>
                        <DialogDescription>
                            {format(t.settings.restoreDesc, {
                                fileName: selectedBackup?.name ?? 'the selected backup'
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRestoreDialogOpen(false)}>
                            {t.settings.cancel}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={!selectedBackup || restoring}
                            onClick={handleConfirmRestore}>
                            {restoring ? t.settings.stagingRestore : t.settings.restoreBackup}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
