import { useRef, useState, useEffect } from 'react'
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
import { downloadBusinessDataExcel } from '@/redux/api/analyticsApi'
import { selectCurrentUser, selectAuthToken } from '@/redux/slices/authSlice'
import { Link } from 'react-router-dom'
import { ArchiveRestore, Database, FileSpreadsheet, ImageIcon, Languages, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import {
    DEFAULT_POS_BANNER_HEIGHT,
    MAX_POS_BANNER_HEIGHT,
    MIN_POS_BANNER_HEIGHT,
    useGetSettingsQuery,
    useRemovePosBannerMutation,
    useUpdateSettingsMutation,
    useUploadPosBannerMutation
} from '@/redux/api/settingsApi'

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()
    const { t, uiLanguage, documentLanguage, setUiLanguage, setDocumentLanguage, format } = useLanguage()
    const user = useSelector(selectCurrentUser)
    const token = useSelector(selectAuthToken)
    const [restoreBackup, { isLoading: restoring }] = useRestoreBackupMutation()
    const [downloading, setDownloading] = useState(false)
    const [exportingBusinessData, setExportingBusinessData] = useState(false)
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
    const [selectedBackup, setSelectedBackup] = useState<File | null>(null)
    const [savingLanguage, setSavingLanguage] = useState(false)
    const [bannerHeight, setBannerHeight] = useState(DEFAULT_POS_BANNER_HEIGHT)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)

    const { data: settingsData } = useGetSettingsQuery()
    const [updateSettings, { isLoading: savingBannerHeight }] = useUpdateSettingsMutation()
    const [uploadPosBanner, { isLoading: uploadingBanner }] = useUploadPosBannerMutation()
    const [removePosBanner, { isLoading: removingBanner }] = useRemovePosBannerMutation()

    const posBannerUrl = settingsData?.settings?.posBannerUrl ?? null
    const posBannerHeightPx = settingsData?.settings?.posBannerHeightPx ?? DEFAULT_POS_BANNER_HEIGHT

    useEffect(() => {
        setBannerHeight(posBannerHeightPx)
    }, [posBannerHeightPx])

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

    const handleExportBusinessData = async () => {
        setExportingBusinessData(true)
        try {
            const fileName = await downloadBusinessDataExcel(() => token)
            toast.success(format(t.settings.businessDataExported, { fileName }))
        } catch (err) {
            toast.error(getApiErrorMessage(err, t.settings.businessDataExportFailed))
        } finally {
            setExportingBusinessData(false)
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

    const handleBannerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error(t.settings.posBannerUploadFailed)
            return
        }

        try {
            await uploadPosBanner(file).unwrap()
            toast.success(t.settings.posBannerUploaded)
        } catch (err) {
            toast.error(getApiErrorMessage(err, t.settings.posBannerUploadFailed))
        }
    }

    const handleRemoveBanner = async () => {
        try {
            await removePosBanner().unwrap()
            toast.success(t.settings.posBannerRemoved)
        } catch (err) {
            toast.error(getApiErrorMessage(err, t.settings.posBannerRemoveFailed))
        }
    }

    const handleSaveBannerHeight = async () => {
        const clamped = Math.min(MAX_POS_BANNER_HEIGHT, Math.max(MIN_POS_BANNER_HEIGHT, Math.round(bannerHeight)))
        setBannerHeight(clamped)

        try {
            await updateSettings({ posBannerHeightPx: clamped }).unwrap()
            toast.success(t.settings.posBannerHeightSaved)
        } catch (err) {
            toast.error(getApiErrorMessage(err, t.settings.posBannerHeightSaveFailed))
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

            {canWrite ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ImageIcon className="size-5" />
                            {t.settings.posBanner}
                        </CardTitle>
                        <CardDescription>{t.settings.posBannerDesc}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>{t.settings.posBannerPreview}</Label>
                            {posBannerUrl ? (
                                <img
                                    src={posBannerUrl}
                                    alt={t.settings.posBanner}
                                    style={{ height: bannerHeight }}
                                    className="block w-full rounded-md border object-fill"
                                />
                            ) : (
                                <div
                                    style={{ height: bannerHeight }}
                                    className="text-muted-foreground flex w-full items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 text-center text-sm">
                                    {t.settings.posBannerPlaceholder}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                disabled={uploadingBanner}
                                onClick={() => bannerInputRef.current?.click()}>
                                {uploadingBanner ? t.settings.uploadingPosBanner : t.settings.uploadPosBanner}
                            </Button>
                            {posBannerUrl ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={removingBanner}
                                    onClick={() => void handleRemoveBanner()}>
                                    {removingBanner ? t.settings.removingPosBanner : t.settings.removePosBanner}
                                </Button>
                            ) : null}
                            <input
                                ref={bannerInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => void handleBannerFileChange(event)}
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="pos-banner-height">{t.settings.posBannerHeight}</Label>
                                <p className="text-sm text-muted-foreground">
                                    {format(t.settings.posBannerHeightDesc, {
                                        min: String(MIN_POS_BANNER_HEIGHT),
                                        max: String(MAX_POS_BANNER_HEIGHT)
                                    })}
                                </p>
                            </div>
                            <div className="flex w-full gap-2 sm:w-auto">
                                <Input
                                    id="pos-banner-height"
                                    type="number"
                                    min={MIN_POS_BANNER_HEIGHT}
                                    max={MAX_POS_BANNER_HEIGHT}
                                    value={bannerHeight}
                                    onChange={(event) => setBannerHeight(Number(event.target.value))}
                                    className="w-full sm:w-28"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={savingBannerHeight}
                                    onClick={() => void handleSaveBannerHeight()}>
                                    {savingBannerHeight ? '...' : 'Save'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

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

            {canManageBackup ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="size-5" />
                            {t.settings.businessDataExport}
                        </CardTitle>
                        <CardDescription>{t.settings.businessDataExportDesc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            type="button"
                            onClick={handleExportBusinessData}
                            disabled={exportingBusinessData}>
                            {exportingBusinessData ? t.settings.exportingBusinessData : t.settings.exportBusinessData}
                        </Button>
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
