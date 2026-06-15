import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TServerAction, CustomServerAction, BuiltInServerAction } from '@/types/actions'

type TServerSheetProps = {
    action: TServerAction | null
    onUpdate: (action: TServerAction) => void
}

// Helper to create default action based on type
const getDefaultAction = (type: string): TServerAction => {
    if (type === 'built-in') {
        return {
            name: 'builtInServerAction',
            type: 'built-in',
            runtimeEnvRef: 'environment',
            action: {
                timeout: 30000,
                function: 'get-otp'
            }
        } as BuiltInServerAction
    }

    return {
        name: 'customServerAction',
        type: 'custom',
        runtimeEnvRef: 'environment',
        action: {
            url: '',
            method: 'GET',
            body: null
        }
    } as CustomServerAction
}

// Available action types for the dropdown
const actionTypeOptions = [
    { value: 'custom', label: 'Custom Server Action' },
    { value: 'built-in', label: 'Built-in Server Action' }
]

// HTTP methods
const httpMethods = [
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'DELETE', label: 'DELETE' }
]

// Runtime environment options
const runtimeEnvOptions = [
    { value: 'environment', label: 'Environment' },
    { value: 'context', label: 'Context' }
]

function ServerSheet({ action, onUpdate }: TServerSheetProps) {
    const [formData, setFormData] = useState<TServerAction | null>(null)

    useEffect(() => {
        if (action) {
            setFormData(action)
        }
    }, [action])

    if (!formData) return null

    const isCustom = formData.type === 'custom'

    const handleActionTypeChange = (newType: string) => {
        const newAction = getDefaultAction(newType)
        setFormData(newAction)
    }

    const handleRuntimeEnvChange = (value: 'environment' | 'context') => {
        setFormData({
            ...formData,
            runtimeEnvRef: value
        })
    }

    const handleCustomActionChange = (field: string, value: any) => {
        if (!isCustom) return
        const customAction = formData as CustomServerAction
        setFormData({
            ...customAction,
            action: {
                ...customAction.action,
                [field]: value
            }
        })
    }

    const handleBuiltInActionChange = (field: string, value: any) => {
        if (isCustom) return
        const builtInAction = formData as BuiltInServerAction
        setFormData({
            ...builtInAction,
            action: {
                ...builtInAction.action,
                [field]: value
            }
        })
    }

    const handleSave = () => {
        if (formData) {
            onUpdate(formData)
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                    value={formData.type}
                    onValueChange={handleActionTypeChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select action type" />
                    </SelectTrigger>
                    <SelectContent>
                        {actionTypeOptions.map((type) => (
                            <SelectItem
                                key={type.value}
                                value={type.value}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Runtime Environment Reference</Label>
                <Select
                    value={formData.runtimeEnvRef}
                    onValueChange={handleRuntimeEnvChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select runtime environment" />
                    </SelectTrigger>
                    <SelectContent>
                        {runtimeEnvOptions.map((option) => (
                            <SelectItem
                                key={option.value}
                                value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    {formData.runtimeEnvRef === 'environment'
                        ? 'Uses environment-level variables and configuration'
                        : 'Uses context-specific variables from the current execution context'}
                </p>
            </div>

            {!isCustom ? (
                // Built-in Action Form
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="builtInFunction">Function</Label>
                        <Select
                            value={(formData as BuiltInServerAction).action.function}
                            onValueChange={(value) => handleBuiltInActionChange('function', value)}>
                            <SelectTrigger id="builtInFunction">
                                <SelectValue placeholder="Select function" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="get-otp">Get OTP</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Retrieves OTP from email or SMS</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="timeout">Timeout (ms)</Label>
                        <Input
                            id="timeout"
                            type="number"
                            min="0"
                            value={(formData as BuiltInServerAction).action.timeout}
                            onChange={(e) => handleBuiltInActionChange('timeout', parseInt(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Maximum time to wait for OTP retrieval</p>
                    </div>

                    <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-md">
                        This built-in action will automatically retrieve OTP from the configured email or SMS provider.
                    </div>
                </div>
            ) : (
                // Custom Action Form
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="url">URL</Label>
                        <Input
                            id="url"
                            type="url"
                            value={(formData as CustomServerAction).action.url}
                            onChange={(e) => handleCustomActionChange('url', e.target.value)}
                            placeholder="https://api.example.com/endpoint"
                        />
                        <p className="text-xs text-muted-foreground">Server endpoint URL</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="method">HTTP Method</Label>
                        <Select
                            value={(formData as CustomServerAction).action.method}
                            onValueChange={(value) => handleCustomActionChange('method', value)}>
                            <SelectTrigger id="method">
                                <SelectValue placeholder="Select HTTP method" />
                            </SelectTrigger>
                            <SelectContent>
                                {httpMethods.map((method) => (
                                    <SelectItem
                                        key={method.value}
                                        value={method.value}>
                                        {method.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="body">Request Body (JSON)</Label>
                        <Textarea
                            id="body"
                            value={JSON.stringify((formData as CustomServerAction).action.body, null, 2)}
                            onChange={(e) => {
                                try {
                                    const body = JSON.parse(e.target.value)
                                    handleCustomActionChange('body', body)
                                } catch (err) {
                                    // Invalid JSON, don't update
                                }
                            }}
                            placeholder='{
  "key": "value"
}'
                            rows={8}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">JSON payload to send with the request</p>
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="sendEmptyBody">Send Empty Body</Label>
                        <Switch
                            id="sendEmptyBody"
                            checked={(formData as CustomServerAction).action.body === null}
                            onCheckedChange={(checked) => {
                                handleCustomActionChange('body', checked ? null : {})
                            }}
                        />
                    </div>

                    <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-md text-sm">
                        <p className="font-medium mb-2">Variables Support</p>
                        <p>
                            You can use <code className="bg-background px-1 rounded">{'{{variable}}'}</code> syntax to reference:
                        </p>
                        <ul className="text-xs mt-2 space-y-1">
                            <li>• Environment variables</li>
                            <li>• Context variables</li>
                            <li>• Previous action outputs</li>
                        </ul>
                    </div>
                </div>
            )}

            <Button
                onClick={handleSave}
                className="w-full">
                Update Server Action
            </Button>
        </div>
    )
}

export default ServerSheet
