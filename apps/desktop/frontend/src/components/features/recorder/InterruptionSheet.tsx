import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TInterruptionAction } from '@/types/actions'

type TInterruptionSheetProps = {
    action: TInterruptionAction | null
    onUpdate: (action: TInterruptionAction) => void
}

// Helper to create default action
const getDefaultAction = (): TInterruptionAction => {
    return {
        name: 'interruptionAction',
        timeout: 5000,
        preconditionSelector: null,
        resolve: {
            selector: '',
            attr: 'visible'
        }
    }
}

// Resolution attribute options
const resolveAttrOptions = [
    { value: 'visible', label: 'Visible', description: 'Wait for element to become visible' },
    { value: 'hidden', label: 'Hidden', description: 'Wait for element to become hidden' }
]

function InterruptionSheet({ action, onUpdate }: TInterruptionSheetProps) {
    const [formData, setFormData] = useState<TInterruptionAction | null>(null)

    useEffect(() => {
        if (action) {
            setFormData(action)
        } else {
            setFormData(getDefaultAction())
        }
    }, [action])

    if (!formData) return null

    const handleFieldChange = (field: keyof TInterruptionAction, value: any) => {
        setFormData({
            ...formData,
            [field]: value
        })
    }

    const handleResolveChange = (field: 'selector' | 'attr', value: string) => {
        setFormData({
            ...formData,
            resolve: {
                ...formData.resolve,
                [field]: value
            }
        })
    }

    const handlePreconditionToggle = (checked: boolean) => {
        setFormData({
            ...formData,
            preconditionSelector: checked ? '' : null
        })
    }

    const handleSave = () => {
        if (formData) {
            onUpdate(formData)
        }
    }

    const hasPrecondition = formData.preconditionSelector !== null

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                    id="timeout"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.timeout}
                    onChange={(e) => handleFieldChange('timeout', parseInt(e.target.value))}
                    placeholder="5000"
                />
                <p className="text-xs text-muted-foreground">Maximum time to wait for the resolution condition before timing out</p>
                <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Common values:</span> 3000 (3s), 5000 (5s), 10000 (10s), 30000 (30s)
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="precondition">Precondition Selector</Label>
                    <div className="flex items-center gap-2">
                        <Label
                            htmlFor="enablePrecondition"
                            className="text-xs text-muted-foreground">
                            Enable
                        </Label>
                        <Switch
                            id="enablePrecondition"
                            checked={hasPrecondition}
                            onCheckedChange={handlePreconditionToggle}
                        />
                    </div>
                </div>
                {hasPrecondition && (
                    <>
                        <Input
                            id="precondition"
                            value={formData.preconditionSelector || ''}
                            onChange={(e) => handleFieldChange('preconditionSelector', e.target.value)}
                            placeholder="#loading-spinner, .modal-overlay, [data-loading='true']"
                        />
                        <p className="text-xs text-muted-foreground">Optional: Element must exist before starting to wait for resolution</p>
                        <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Example:</span> <code className="bg-muted px-1 rounded">.modal-container</code> - waits for
                            modal to appear before checking resolution
                        </div>
                    </>
                )}
                {!hasPrecondition && (
                    <div className="p-3 bg-muted/30 rounded-md text-xs text-muted-foreground">
                        No precondition required. The interruption will immediately start waiting for the resolution condition.
                    </div>
                )}
            </div>

            <div className="space-y-4 p-4 border rounded-md bg-muted/10">
                <Label className="text-base">Resolution Condition</Label>

                <div className="space-y-2">
                    <Label htmlFor="resolveSelector">Selector</Label>
                    <Input
                        id="resolveSelector"
                        value={formData.resolve.selector}
                        onChange={(e) => handleResolveChange('selector', e.target.value)}
                        placeholder="#success-message, .content-loaded, [data-loaded='true']"
                    />
                    <p className="text-xs text-muted-foreground">CSS selector or XPath for the element to watch</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="resolveAttr">Condition</Label>
                    <Select
                        value={formData.resolve.attr}
                        onValueChange={(value: 'visible' | 'hidden') => handleResolveChange('attr', value)}>
                        <SelectTrigger id="resolveAttr">
                            <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                            {resolveAttrOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}>
                                    <div className="flex flex-col">
                                        <span>{option.label}</span>
                                        <span className="text-xs text-muted-foreground">{option.description}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {formData.resolve.attr === 'visible'
                            ? 'Waits for the element to become visible on the page'
                            : 'Waits for the element to become hidden or removed from the page'}
                    </p>
                </div>
            </div>

            <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs font-medium mb-2">How it works:</p>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                        <span className="font-medium">Precondition check</span> - If specified, waits for precondition element to exist
                    </li>
                    <li>
                        <span className="font-medium">Resolution monitoring</span> - Continuously checks the resolution condition
                    </li>
                    <li>
                        <span className="font-medium">Timeout</span> - If condition isn't met within timeout, action fails
                    </li>
                    <li>
                        <span className="font-medium">Success</span> - When condition is met, flow continues to next action
                    </li>
                </ol>
            </div>

            <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs font-medium mb-2">Common Use Cases:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>
                        Wait for loading spinners to disappear (<code className="bg-background px-1 rounded">attr: hidden</code>)
                    </li>
                    <li>
                        Wait for AJAX content to load (<code className="bg-background px-1 rounded">attr: visible</code>)
                    </li>
                    <li>Wait for modal dialogs to appear before interacting</li>
                    <li>Wait for page transitions or navigation to complete</li>
                    <li>Wait for API responses to update the DOM</li>
                </ul>
            </div>

            <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs font-medium mb-2">Variables Support:</p>
                <p className="text-xs text-muted-foreground">
                    You can use <code className="bg-background px-1 rounded">{'{{variable}}'}</code> syntax in selectors to reference:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Environment variables</li>
                    <li>Context variables</li>
                    <li>Previous action outputs</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                    Example: <code className="bg-background px-1 rounded">#dynamicId-container</code>
                </p>
            </div>

            <Button
                onClick={handleSave}
                className="w-full">
                Update Interruption Action
            </Button>
        </div>
    )
}

export default InterruptionSheet
