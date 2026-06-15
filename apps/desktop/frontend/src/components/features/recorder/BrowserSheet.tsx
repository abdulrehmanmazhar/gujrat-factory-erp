import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { LaunchBrowserAction, CloseBrowserAction, PlaywrightConfigs } from '@/types/actions'

type TBrowserSheetProps = {
    action: LaunchBrowserAction | CloseBrowserAction | null
    onUpdate: (action: LaunchBrowserAction | CloseBrowserAction) => void
}

// Helper to create default action based on type
const getDefaultAction = (type: string): LaunchBrowserAction | CloseBrowserAction => {
    if (type === 'closeBrowser') {
        return { name: 'closeBrowser' }
    }

    return {
        name: 'launchBrowser',
        config: {
            userDataDir: '',
            launch: {
                headless: false,
                executablePath: '',
                channel: 'chrome',
                args: [],
                ignoreDefaultArgs: false,
                devtools: false,
                slowMo: 0,
                timeout: 30000,
                proxy: {
                    server: '',
                    bypass: '',
                    username: '',
                    password: ''
                },
                ignoreHTTPSErrors: false,
                bypassCSP: false,
                httpCredentials: {
                    username: '',
                    password: ''
                },
                acceptDownloads: true,
                downloadsPath: '',
                locale: '',
                timezoneId: '',
                geolocation: {
                    latitude: 0,
                    longitude: 0,
                    accuracy: 0
                },
                permissions: [],
                viewport: { width: 1280, height: 720 },
                screen: { width: 1920, height: 1080 },
                deviceScaleFactor: 1,
                isMobile: false,
                hasTouch: false,
                userAgent: '',
                extraHTTPHeaders: {},
                storageState: '',
                offline: false,
                colorScheme: 'no-preference',
                reducedMotion: 'no-preference',
                forcedColors: 'none',
                javaScriptEnabled: true,
                recordHar: {
                    path: '',
                    content: 'embed',
                    mode: 'full'
                },
                recordVideo: {
                    dir: '',
                    size: { width: 1280, height: 720 }
                },
                serviceWorkers: 'allow',
                baseURL: '',
                strictSelectors: false,
                clientCertificates: []
            },
            execution: {
                blockUserInput: false,
                humanInLoopOnError: false,
                maxRetries: 3,
                actionTimeout: 30000,
                navigationTimeout: 60000
            }
        }
    }
}

// Available action types for the dropdown
const actionTypes = [
    { value: 'launchBrowser', label: 'Launch Browser' },
    { value: 'closeBrowser', label: 'Close Browser' }
]

function BrowserSheet({ action, onUpdate }: TBrowserSheetProps) {
    const [formData, setFormData] = useState<LaunchBrowserAction | CloseBrowserAction | null>(null)

    useEffect(() => {
        if (action) {
            setFormData(action)
        }
    }, [action])

    if (!formData) return null

    const isLaunch = formData.name === 'launchBrowser'

    const handleActionTypeChange = (newType: string) => {
        const newAction = getDefaultAction(newType)
        setFormData(newAction)
    }

    const handleLaunchConfigChange = (path: string, value: any) => {
        if (!isLaunch) return

        const launchAction = formData as LaunchBrowserAction
        const keys = path.split('.')
        let updated = { ...launchAction.config }

        if (keys[0] === 'launch') {
            if (keys.length === 2) {
                updated.launch = { ...updated.launch, [keys[1]]: value }
            } else if (keys.length === 3) {
                updated.launch = {
                    ...updated.launch,
                    [keys[1]]: {
                        ...(updated.launch[keys[1] as keyof typeof updated.launch] as object),
                        [keys[2]]: value
                    }
                }
            } else if (keys.length === 4) {
                updated.launch = {
                    ...updated.launch,
                    [keys[1]]: {
                        ...(updated.launch[keys[1] as keyof typeof updated.launch] as object),
                        [keys[2]]: {
                            ...((updated.launch[keys[1] as keyof typeof updated.launch] as any)?.[keys[2]] || {}),
                            [keys[3]]: value
                        }
                    }
                }
            }
        } else if (keys[0] === 'execution') {
            updated.execution = { ...updated.execution, [keys[1]]: value }
        } else if (keys[0] === 'userDataDir') {
            updated.userDataDir = value
        }

        setFormData({
            ...launchAction,
            config: updated
        })
    }

    const handleSave = () => {
        if (formData) {
            onUpdate(formData)
        }
    }

    const config = isLaunch ? (formData as LaunchBrowserAction).config : null

    if (!isLaunch) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label>Action Type</Label>
                    <Select
                        value={formData.name}
                        onValueChange={handleActionTypeChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select action type" />
                        </SelectTrigger>
                        <SelectContent>
                            {actionTypes.map((type) => (
                                <SelectItem
                                    key={type.value}
                                    value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-md">
                    This action will close the current browser session and clean up all resources.
                </div>

                <Button
                    onClick={handleSave}
                    className="w-full">
                    Update Action
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                    value={formData.name}
                    onValueChange={handleActionTypeChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select action type" />
                    </SelectTrigger>
                    <SelectContent>
                        {actionTypes.map((type) => (
                            <SelectItem
                                key={type.value}
                                value={type.value}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Tabs
                defaultValue="core"
                className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="core">Core</TabsTrigger>
                    <TabsTrigger value="browser">Browser</TabsTrigger>
                    <TabsTrigger value="network">Network</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent
                    value="core"
                    className="space-y-4 mt-4">
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full">
                        <AccordionItem value="core-settings">
                            <AccordionTrigger>Core Settings</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="channel">Browser Channel</Label>
                                    <Select
                                        value={config!.launch.channel || 'chrome'}
                                        onValueChange={(value) => handleLaunchConfigChange('launch.channel', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select browser" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="chrome">Chrome</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="executablePath">Executable Path</Label>
                                    <Input
                                        id="executablePath"
                                        value={config!.launch.executablePath || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.executablePath', e.target.value)}
                                        placeholder="/path/to/browser/executable"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="headless">Headless Mode</Label>
                                    <Switch
                                        id="headless"
                                        checked={config!.launch.headless || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.headless', checked)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="args">Launch Arguments</Label>
                                    <Textarea
                                        id="args"
                                        value={config!.launch.args?.join('\n') || ''}
                                        onChange={(e) =>
                                            handleLaunchConfigChange(
                                                'launch.args',
                                                e.target.value.split('\n').filter((s) => s.trim())
                                            )
                                        }
                                        placeholder="--disable-web-security&#10;--disable-features=IsolateOrigins"
                                        rows={3}
                                    />
                                    <p className="text-xs text-muted-foreground">One argument per line</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ignoreDefaultArgs">Ignore Default Args</Label>
                                    <Switch
                                        id="ignoreDefaultArgs"
                                        checked={typeof config!.launch.ignoreDefaultArgs === 'boolean' ? config!.launch.ignoreDefaultArgs : false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.ignoreDefaultArgs', checked)}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="debug">
                            <AccordionTrigger>Debug & Dev</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="devtools">DevTools</Label>
                                    <Switch
                                        id="devtools"
                                        checked={config!.launch.devtools || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.devtools', checked)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="slowMo">Slow Motion (ms)</Label>
                                    <Input
                                        id="slowMo"
                                        type="number"
                                        min="0"
                                        value={config!.launch.slowMo || 0}
                                        onChange={(e) => handleLaunchConfigChange('launch.slowMo', parseInt(e.target.value))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="timeout">Timeout (ms)</Label>
                                    <Input
                                        id="timeout"
                                        type="number"
                                        min="0"
                                        value={config!.launch.timeout || 30000}
                                        onChange={(e) => handleLaunchConfigChange('launch.timeout', parseInt(e.target.value))}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="user-data">
                            <AccordionTrigger>User Data</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="userDataDir">User Data Directory</Label>
                                    <Input
                                        id="userDataDir"
                                        value={config!.userDataDir || ''}
                                        onChange={(e) => handleLaunchConfigChange('userDataDir', e.target.value)}
                                        placeholder="/path/to/user-data-dir"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="storageState">Storage State</Label>
                                    <Input
                                        id="storageState"
                                        value={typeof config!.launch.storageState === 'string' ? config!.launch.storageState : ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.storageState', e.target.value)}
                                        placeholder="/path/to/storage-state.json"
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </TabsContent>

                <TabsContent
                    value="browser"
                    className="space-y-4 mt-4">
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full">
                        <AccordionItem value="viewport">
                            <AccordionTrigger>Viewport & Screen</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Viewport Size</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            placeholder="Width"
                                            type="number"
                                            value={config!.launch.viewport?.width || ''}
                                            onChange={(e) =>
                                                handleLaunchConfigChange('launch.viewport', {
                                                    ...config!.launch.viewport,
                                                    width: parseInt(e.target.value)
                                                })
                                            }
                                        />
                                        <Input
                                            placeholder="Height"
                                            type="number"
                                            value={config!.launch.viewport?.height || ''}
                                            onChange={(e) =>
                                                handleLaunchConfigChange('launch.viewport', {
                                                    ...config!.launch.viewport,
                                                    height: parseInt(e.target.value)
                                                })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Screen Size</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            placeholder="Width"
                                            type="number"
                                            value={config!.launch.screen?.width || ''}
                                            onChange={(e) =>
                                                handleLaunchConfigChange('launch.screen', {
                                                    ...config!.launch.screen,
                                                    width: parseInt(e.target.value)
                                                })
                                            }
                                        />
                                        <Input
                                            placeholder="Height"
                                            type="number"
                                            value={config!.launch.screen?.height || ''}
                                            onChange={(e) =>
                                                handleLaunchConfigChange('launch.screen', {
                                                    ...config!.launch.screen,
                                                    height: parseInt(e.target.value)
                                                })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="deviceScaleFactor">Device Scale Factor</Label>
                                    <Input
                                        id="deviceScaleFactor"
                                        type="number"
                                        step="0.5"
                                        value={config!.launch.deviceScaleFactor || 1}
                                        onChange={(e) => handleLaunchConfigChange('launch.deviceScaleFactor', parseFloat(e.target.value))}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="device">
                            <AccordionTrigger>Device Emulation</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="isMobile">Mobile Emulation</Label>
                                    <Switch
                                        id="isMobile"
                                        checked={config!.launch.isMobile || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.isMobile', checked)}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="hasTouch">Has Touch</Label>
                                    <Switch
                                        id="hasTouch"
                                        checked={config!.launch.hasTouch || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.hasTouch', checked)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="userAgent">User Agent</Label>
                                    <Input
                                        id="userAgent"
                                        value={config!.launch.userAgent || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.userAgent', e.target.value)}
                                        placeholder="Custom user agent string"
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="locale">
                            <AccordionTrigger>Locale & Region</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="locale">Locale</Label>
                                    <Input
                                        id="locale"
                                        value={config!.launch.locale || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.locale', e.target.value)}
                                        placeholder="en-US"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="timezoneId">Timezone</Label>
                                    <Input
                                        id="timezoneId"
                                        value={config!.launch.timezoneId || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.timezoneId', e.target.value)}
                                        placeholder="America/New_York"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Geolocation</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Input
                                            placeholder="Latitude"
                                            type="number"
                                            step="any"
                                            value={config!.launch.geolocation?.latitude || ''}
                                            onChange={(e) =>
                                                handleLaunchConfigChange('launch.geolocation', {
                                                    ...config!.launch.geolocation,
                                                    latitude: parseFloat(e.target.value)
                                                })
                                            }
                                        />
                                        <Input
                                            placeholder="Longitude"
                                            type="number"
                                            step="any"
                                            value={config!.launch.geolocation?.longitude || ''}
                                            onChange={(e) =>
                                                handleLaunchConfigChange('launch.geolocation', {
                                                    ...config!.launch.geolocation,
                                                    longitude: parseFloat(e.target.value)
                                                })
                                            }
                                        />
                                        <Input
                                            placeholder="Accuracy"
                                            type="number"
                                            value={config!.launch.geolocation?.accuracy || ''}
                                            onChange={(e) =>
                                                handleLaunchConfigChange('launch.geolocation', {
                                                    ...config!.launch.geolocation,
                                                    accuracy: parseInt(e.target.value)
                                                })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="permissions">Permissions</Label>
                                    <Textarea
                                        id="permissions"
                                        value={config!.launch.permissions?.join('\n') || ''}
                                        onChange={(e) =>
                                            handleLaunchConfigChange(
                                                'launch.permissions',
                                                e.target.value.split('\n').filter((s) => s.trim())
                                            )
                                        }
                                        placeholder="geolocation&#10;notifications&#10;camera"
                                        rows={3}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="rendering">
                            <AccordionTrigger>Rendering & Media</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="colorScheme">Color Scheme</Label>
                                    <Select
                                        value={config!.launch.colorScheme || 'no-preference'}
                                        onValueChange={(value) => handleLaunchConfigChange('launch.colorScheme', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select color scheme" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="light">Light</SelectItem>
                                            <SelectItem value="dark">Dark</SelectItem>
                                            <SelectItem value="no-preference">No Preference</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="reducedMotion">Reduced Motion</Label>
                                    <Select
                                        value={config!.launch.reducedMotion || 'no-preference'}
                                        onValueChange={(value) => handleLaunchConfigChange('launch.reducedMotion', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select reduced motion" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="reduce">Reduce</SelectItem>
                                            <SelectItem value="no-preference">No Preference</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="forcedColors">Forced Colors</Label>
                                    <Select
                                        value={config!.launch.forcedColors || 'none'}
                                        onValueChange={(value) => handleLaunchConfigChange('launch.forcedColors', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select forced colors" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="none">None</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="javaScriptEnabled">JavaScript Enabled</Label>
                                    <Switch
                                        id="javaScriptEnabled"
                                        checked={config!.launch.javaScriptEnabled !== false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.javaScriptEnabled', checked)}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="service-workers">
                            <AccordionTrigger>Service Workers & Base URL</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="serviceWorkers">Service Workers</Label>
                                    <Select
                                        value={config!.launch.serviceWorkers || 'allow'}
                                        onValueChange={(value) => handleLaunchConfigChange('launch.serviceWorkers', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select service worker policy" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="allow">Allow</SelectItem>
                                            <SelectItem value="block">Block</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="baseURL">Base URL</Label>
                                    <Input
                                        id="baseURL"
                                        value={config!.launch.baseURL || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.baseURL', e.target.value)}
                                        placeholder="https://example.com"
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </TabsContent>

                <TabsContent
                    value="network"
                    className="space-y-4 mt-4">
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full">
                        <AccordionItem value="proxy">
                            <AccordionTrigger>Proxy Settings</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="proxyServer">Proxy Server</Label>
                                    <Input
                                        id="proxyServer"
                                        value={config!.launch.proxy?.server || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.proxy.server', e.target.value)}
                                        placeholder="http://proxy.example.com:8080"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proxyBypass">Proxy Bypass</Label>
                                    <Input
                                        id="proxyBypass"
                                        value={config!.launch.proxy?.bypass || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.proxy.bypass', e.target.value)}
                                        placeholder="localhost, 127.0.0.1"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proxyUsername">Proxy Username</Label>
                                    <Input
                                        id="proxyUsername"
                                        value={config!.launch.proxy?.username || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.proxy.username', e.target.value)}
                                        placeholder="username"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proxyPassword">Proxy Password</Label>
                                    <Input
                                        id="proxyPassword"
                                        type="password"
                                        value={config!.launch.proxy?.password || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.proxy.password', e.target.value)}
                                        placeholder="password"
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="security">
                            <AccordionTrigger>Security</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="ignoreHTTPSErrors">Ignore HTTPS Errors</Label>
                                    <Switch
                                        id="ignoreHTTPSErrors"
                                        checked={config!.launch.ignoreHTTPSErrors || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.ignoreHTTPSErrors', checked)}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="bypassCSP">Bypass CSP</Label>
                                    <Switch
                                        id="bypassCSP"
                                        checked={config!.launch.bypassCSP || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.bypassCSP', checked)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="httpCredentialsUsername">HTTP Credentials Username</Label>
                                    <Input
                                        id="httpCredentialsUsername"
                                        value={config!.launch.httpCredentials?.username || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.httpCredentials.username', e.target.value)}
                                        placeholder="username"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="httpCredentialsPassword">HTTP Credentials Password</Label>
                                    <Input
                                        id="httpCredentialsPassword"
                                        type="password"
                                        value={config!.launch.httpCredentials?.password || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.httpCredentials.password', e.target.value)}
                                        placeholder="password"
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="downloads">
                            <AccordionTrigger>Downloads & Headers</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="acceptDownloads">Accept Downloads</Label>
                                    <Switch
                                        id="acceptDownloads"
                                        checked={config!.launch.acceptDownloads !== false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.acceptDownloads', checked)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="downloadsPath">Downloads Path</Label>
                                    <Input
                                        id="downloadsPath"
                                        value={config!.launch.downloadsPath || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.downloadsPath', e.target.value)}
                                        placeholder="/path/to/downloads"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="extraHTTPHeaders">Extra HTTP Headers</Label>
                                    <Textarea
                                        id="extraHTTPHeaders"
                                        value={JSON.stringify(config!.launch.extraHTTPHeaders || {}, null, 2)}
                                        onChange={(e) => {
                                            try {
                                                const headers = JSON.parse(e.target.value)
                                                handleLaunchConfigChange('launch.extraHTTPHeaders', headers)
                                            } catch (err) {
                                                // Invalid JSON, ignore
                                            }
                                        }}
                                        placeholder='{
  "Authorization": "Bearer token",
  "X-Custom-Header": "value"
}'
                                        rows={5}
                                        className="font-mono text-sm"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="offline">Offline Mode</Label>
                                    <Switch
                                        id="offline"
                                        checked={config!.launch.offline || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.offline', checked)}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </TabsContent>

                <TabsContent
                    value="advanced"
                    className="space-y-4 mt-4">
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full">
                        <AccordionItem value="recording">
                            <AccordionTrigger>Recording & Debugging</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="recordHarPath">HAR Recording Path</Label>
                                    <Input
                                        id="recordHarPath"
                                        value={config!.launch.recordHar?.path || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.recordHar.path', e.target.value)}
                                        placeholder="/path/to/recording.har"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="recordHarContent">HAR Content</Label>
                                    <Select
                                        value={config!.launch.recordHar?.content || 'embed'}
                                        onValueChange={(value) => handleLaunchConfigChange('launch.recordHar.content', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select content type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="omit">Omit</SelectItem>
                                            <SelectItem value="embed">Embed</SelectItem>
                                            <SelectItem value="attach">Attach</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="recordHarMode">HAR Mode</Label>
                                    <Select
                                        value={config!.launch.recordHar?.mode || 'full'}
                                        onValueChange={(value) => handleLaunchConfigChange('launch.recordHar.mode', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="full">Full</SelectItem>
                                            <SelectItem value="minimal">Minimal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="recordVideoDir">Video Recording Directory</Label>
                                    <Input
                                        id="recordVideoDir"
                                        value={config!.launch.recordVideo?.dir || ''}
                                        onChange={(e) => handleLaunchConfigChange('launch.recordVideo.dir', e.target.value)}
                                        placeholder="/path/to/videos"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Video Size</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            placeholder="Width"
                                            type="number"
                                            value={config!.launch.recordVideo?.size?.width || ''}
                                            onChange={(e) => handleLaunchConfigChange('launch.recordVideo.size.width', parseInt(e.target.value))}
                                        />
                                        <Input
                                            placeholder="Height"
                                            type="number"
                                            value={config!.launch.recordVideo?.size?.height || ''}
                                            onChange={(e) => handleLaunchConfigChange('launch.recordVideo.size.height', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="strict">
                            <AccordionTrigger>Strict Mode & Selectors</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="strictSelectors">Strict Selectors</Label>
                                    <Switch
                                        id="strictSelectors"
                                        checked={config!.launch.strictSelectors || false}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('launch.strictSelectors', checked)}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="certificates">
                            <AccordionTrigger>Client Certificates</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="clientCertificates">Client Certificates (JSON)</Label>
                                    <Textarea
                                        id="clientCertificates"
                                        value={JSON.stringify(config!.launch.clientCertificates || [], null, 2)}
                                        onChange={(e) => {
                                            try {
                                                const certs = JSON.parse(e.target.value)
                                                handleLaunchConfigChange('launch.clientCertificates', certs)
                                            } catch (err) {
                                                // Invalid JSON, ignore
                                            }
                                        }}
                                        placeholder='[
  {
    "origin": "https://example.com",
    "certPath": "/path/to/cert.pem",
    "keyPath": "/path/to/key.pem"
  }
]'
                                        rows={8}
                                        className="font-mono text-sm"
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="execution">
                            <AccordionTrigger>Execution Settings</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="maxRetries">Max Retries</Label>
                                    <Input
                                        id="maxRetries"
                                        type="number"
                                        min="0"
                                        value={config!.execution.maxRetries}
                                        onChange={(e) => handleLaunchConfigChange('execution.maxRetries', parseInt(e.target.value))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="actionTimeout">Action Timeout (ms)</Label>
                                    <Input
                                        id="actionTimeout"
                                        type="number"
                                        min="0"
                                        value={config!.execution.actionTimeout}
                                        onChange={(e) => handleLaunchConfigChange('execution.actionTimeout', parseInt(e.target.value))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="navigationTimeout">Navigation Timeout (ms)</Label>
                                    <Input
                                        id="navigationTimeout"
                                        type="number"
                                        min="0"
                                        value={config!.execution.navigationTimeout}
                                        onChange={(e) => handleLaunchConfigChange('execution.navigationTimeout', parseInt(e.target.value))}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="blockUserInput">Block User Input</Label>
                                    <Switch
                                        id="blockUserInput"
                                        checked={config!.execution.blockUserInput}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('execution.blockUserInput', checked)}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="humanInLoopOnError">Human in Loop on Error</Label>
                                    <Switch
                                        id="humanInLoopOnError"
                                        checked={config!.execution.humanInLoopOnError}
                                        onCheckedChange={(checked) => handleLaunchConfigChange('execution.humanInLoopOnError', checked)}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <Button
                        onClick={handleSave}
                        className="w-full">
                        Update Browser Configuration
                    </Button>
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default BrowserSheet
