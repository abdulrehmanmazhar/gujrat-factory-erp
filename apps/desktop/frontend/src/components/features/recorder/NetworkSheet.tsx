import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TNetworkInterceptorAction } from '@/types/actions'

type TNetworkSheetProps = {
    action: TNetworkInterceptorAction | null
    onUpdate: (action: TNetworkInterceptorAction) => void
}

// Helper to create default action
const getDefaultAction = (): TNetworkInterceptorAction => {
    return {
        name: 'networkInterceptionAction',
        url: '',
        type: 'http',
        action: 'request',
        body: null
    }
}

// Network type options
const networkTypeOptions = [
    { value: 'http', label: 'HTTP/HTTPS' },
    { value: 'ws', label: 'WebSocket' }
]

// Action type options
const actionTypeOptions = [
    { value: 'request', label: 'Request' },
    { value: 'response', label: 'Response' }
]

function NetworkSheet({ action, onUpdate }: TNetworkSheetProps) {
    const [formData, setFormData] = useState<TNetworkInterceptorAction | null>(null)

    useEffect(() => {
        if (action) {
            setFormData(action)
        } else {
            setFormData(getDefaultAction())
        }
    }, [action])

    if (!formData) return null

    const handleFieldChange = (field: keyof TNetworkInterceptorAction, value: any) => {
        setFormData({
            ...formData,
            [field]: value
        })
    }

    const handleBodyChange = (value: string) => {
        try {
            const body = value.trim() === '' ? null : JSON.parse(value)
            setFormData({
                ...formData,
                body
            })
        } catch (err) {
            // Invalid JSON, don't update
        }
    }

    const handleSave = () => {
        if (formData) {
            onUpdate(formData)
        }
    }

    const getBodyString = () => {
        if (formData.body === null) return ''
        return JSON.stringify(formData.body, null, 2)
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="url">URL Pattern</Label>
                <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    placeholder="https://api.example.com/*"
                />
                <p className="text-xs text-muted-foreground">
                    Supports wildcards: <code className="bg-muted px-1 rounded">*</code> matches any characters
                </p>
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p className="font-medium">Examples:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                        <li>
                            <code className="bg-muted px-1 rounded">https://api.example.com/users/*</code> - Match all user endpoints
                        </li>
                        <li>
                            <code className="bg-muted px-1 rounded">https://*.example.com/**</code> - Match any subdomain
                        </li>
                        <li>
                            <code className="bg-muted px-1 rounded">wss://socket.example.com</code> - Exact WebSocket match
                        </li>
                    </ul>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="type">Network Type</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(value: 'http' | 'ws') => handleFieldChange('type', value)}>
                        <SelectTrigger id="type">
                            <SelectValue placeholder="Select network type" />
                        </SelectTrigger>
                        <SelectContent>
                            {networkTypeOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {formData.type === 'http' ? 'Intercept HTTP/HTTPS requests and responses' : 'Intercept WebSocket messages'}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="action">Intercept Action</Label>
                    <Select
                        value={formData.action}
                        onValueChange={(value: 'request' | 'response') => handleFieldChange('action', value)}>
                        <SelectTrigger id="action">
                            <SelectValue placeholder="Select action type" />
                        </SelectTrigger>
                        <SelectContent>
                            {actionTypeOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {formData.action === 'request' ? 'Intercept before the request is sent' : 'Intercept after the response is received'}
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="body">Validation Schema (AJV Compatible JSON Schema)</Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFieldChange('body', null)}
                        className="h-6 text-xs">
                        Clear
                    </Button>
                </div>
                <Textarea
                    id="body"
                    value={getBodyString()}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    placeholder={`{
  "type": "object",
  "properties": {
    "id": { "type": "number" },
    "name": { "type": "string" }
  },
  "required": ["id", "name"]
}`}
                    rows={10}
                    className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                    JSON Schema for validating {formData.action} {formData.type.toUpperCase()} data
                </p>
            </div>

            {formData.body !== null && (
                <div className="p-3 bg-muted/30 rounded-md">
                    <p className="text-xs font-medium mb-2">Schema Validation Info:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Schema will be validated against AJV (Another JSON Schema Validator)</li>
                        <li>Supports draft-07 and earlier</li>
                        <li>Validation errors will be reported in the execution log</li>
                        <li>Invalid {formData.action}s will be rejected/flagged based on configuration</li>
                    </ul>
                </div>
            )}

            <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs font-medium mb-2">Variables Support:</p>
                <p className="text-xs text-muted-foreground">
                    You can use <code className="bg-background px-1 rounded">{'{{variable}}'}</code> syntax in URL patterns to reference:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Environment variables</li>
                    <li>Context variables</li>
                    <li>Previous action outputs</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                    Example: <code className="bg-background px-1 rounded">https://api.example.com/users/</code>
                </p>
            </div>

            <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs font-medium mb-2">Common Schema Examples:</p>
                <div className="space-y-2 text-xs">
                    <div>
                        <p className="font-mono text-xs">Validate array of objects:</p>
                        <pre className="bg-background p-2 rounded mt-1 overflow-x-auto">
                            {`{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "number" }
    }
  }
}`}
                        </pre>
                    </div>
                    <div>
                        <p className="font-mono text-xs">Validate string pattern:</p>
                        <pre className="bg-background p-2 rounded mt-1 overflow-x-auto">
                            {`{
  "type": "string",
  "pattern": "^[A-Za-z0-9]+$"
}`}
                        </pre>
                    </div>
                    <div>
                        <p className="font-mono text-xs">Validate with enum:</p>
                        <pre className="bg-background p-2 rounded mt-1 overflow-x-auto">
                            {`{
  "type": "string",
  "enum": ["active", "inactive", "pending"]
}`}
                        </pre>
                    </div>
                </div>
            </div>

            <Button
                onClick={handleSave}
                className="w-full">
                Update Network Interceptor
            </Button>
        </div>
    )
}

export default NetworkSheet
