import Header from '@/components/features/header'
import { Clock, AlertCircle, FolderOpen, FolderInput, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useState, useEffect } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getStorageSettings, setStorageSettings } from '@/utils/storage'
import type { TSettings } from '@/types/storage'
import { platform } from '@/utils/platform'
import { checkPathExists, getAppPath } from '@/utils/appPaths'

export default function SettingsPage() {
    const [sessionType, setSessionType] = useState<'persistent' | 'temporary'>('persistent')
    const [persistencePath, setPersistencePath] = useState<string>('')
    const [defaultPath, setDefaultPath] = useState<string>('')
    const [isLoading, setIsLoading] = useState(true)

    const loadDefaultPath = async () => {
        const appPath = await getAppPath()
        const defaultChromeSessionPath = `${appPath}/chrome-session`

        const doesExist = await checkPathExists(defaultChromeSessionPath)

        if (!doesExist) {
            await platform.filesystem.createDirectory(defaultChromeSessionPath)
        }

        return defaultChromeSessionPath
    }

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const defaultChromePath = await loadDefaultPath()
                setDefaultPath(defaultChromePath)

                const settings = await getStorageSettings()
                if (settings) {
                    if (settings.sessionType) {
                        setSessionType(settings.sessionType)
                    }
                    if (settings.persistencePath) {
                        setPersistencePath(settings.persistencePath)
                    } else {
                        // Set default path if none exists
                        setPersistencePath(defaultChromePath)
                    }
                } else {
                    // No settings found, set default path
                    setPersistencePath(defaultChromePath)
                }
            } catch (error) {
                console.error('Failed to load settings:', error)
                const defaultChromePath = await loadDefaultPath()
                setDefaultPath(defaultChromePath)
                setPersistencePath(defaultChromePath)
            } finally {
                setIsLoading(false)
            }
        }
        loadSettings()
    }, [])

    // Save settings whenever sessionType or persistencePath changes
    const saveSettings = async (updates: Partial<TSettings>) => {
        try {
            const currentSettings = await getStorageSettings()
            const newSettings: TSettings = {
                sessionType: updates.sessionType ?? currentSettings?.sessionType ?? 'persistent',
                persistencePath: updates.persistencePath ?? currentSettings?.persistencePath ?? defaultPath
            }
            await setStorageSettings(newSettings)
        } catch (error) {
            console.error('Failed to save settings:', error)
        }
    }

    const handleSessionTypeChange = async (value: 'persistent' | 'temporary') => {
        setSessionType(value)
        await saveSettings({ sessionType: value })
    }

    const handlePathChange = async (value: string) => {
        setPersistencePath(value)
        await saveSettings({ persistencePath: value })
    }

    const handleSelectFolder = async () => {
        try {
            // Neutralino select folder dialog
            const result = await platform.os.showFolderDialog('Select Chrome User Data Folder', {
                defaultPath: persistencePath || defaultPath
            })
            if (result) {
                handlePathChange(result)
            }
        } catch (error) {
            console.error('Failed to select folder:', error)
        }
    }

    const handleResetToDefault = async () => {
        if (defaultPath) {
            await handlePathChange(defaultPath)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <Header
                    title="Settings"
                    subtitle="Manage your application preferences"
                />
                <div className="px-4 py-4">
                    <Card className="w-full">
                        <CardContent className="py-8">
                            <div className="flex justify-center">
                                <div className="animate-pulse text-muted-foreground">Loading settings...</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <Header
                title="Settings"
                subtitle="Manage your application preferences"
            />

            {/* Settings Container - Full width with minimal margin */}
            <div className="px-4 py-4 space-y-4">
                {/* Session Type Section */}
                <Card className="w-full">
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
                        <div className="rounded-md bg-muted p-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <CardTitle className="text-sm font-medium">Session Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <RadioGroup
                                value={sessionType}
                                onValueChange={(value) => handleSessionTypeChange(value as 'persistent' | 'temporary')}
                                className="flex flex-col space-y-3">
                                <div className="flex items-center space-x-3 space-y-0">
                                    <RadioGroupItem
                                        value="persistent"
                                        id="persistent"
                                    />
                                    <Label
                                        htmlFor="persistent"
                                        className="font-normal cursor-pointer">
                                        <div>
                                            <span className="font-medium">Persistent Session</span>
                                            <p className="text-sm text-muted-foreground">Save cookies and browser data between sessions.</p>
                                        </div>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-3 space-y-0">
                                    <RadioGroupItem
                                        value="temporary"
                                        id="temporary"
                                    />
                                    <Label
                                        htmlFor="temporary"
                                        className="font-normal cursor-pointer">
                                        <div>
                                            <span className="font-medium">Temporary Session</span>
                                            <p className="text-sm text-muted-foreground">Start fresh each time. No data is saved between sessions.</p>
                                        </div>
                                    </Label>
                                </div>
                            </RadioGroup>

                            {sessionType === 'temporary' && (
                                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
                                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <p className="text-muted-foreground">Browser data will be cleared when you close the session.</p>
                                </div>
                            )}

                            {/* Path Selection - Only shown for persistent sessions */}
                            {sessionType === 'persistent' && (
                                <div className="pt-4 border-t">
                                    <Label className="text-sm font-medium mb-2 block">Chrome Session Data Path</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <FolderInput className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="text"
                                                value={persistencePath}
                                                onChange={(e) => handlePathChange(e.target.value)}
                                                placeholder="Select or enter Chrome session data path"
                                                className="pl-9 font-mono text-sm"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleSelectFolder}
                                            className="gap-2">
                                            <FolderOpen className="h-4 w-4" />
                                            Browse
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResetToDefault}
                                            className="gap-2">
                                            <RotateCcw className="h-4 w-4" />
                                            Reset
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Path to Chrome user data directory where session data will be persisted
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
