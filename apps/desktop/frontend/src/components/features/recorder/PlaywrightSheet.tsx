import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type {
    TPlaywrightAction,
    ClickAction,
    FillAction,
    PressAction,
    SelectAction,
    SetInputFilesAction,
    AssertTextAction,
    AssertValueAction,
    AssertCheckedAction,
    ActionWithSelector,
    HoverAction,
    CheckAction,
    UncheckAction
} from '@/types/actions'

type TPlaywrightSheetProps = {
    action: TPlaywrightAction | null
    onUpdate: (action: TPlaywrightAction) => void
}

// Helper to create default action based on type
const getDefaultAction = (type: string): TPlaywrightAction => {
    const baseWithSelector = {
        signals: [],
        selector: '',
        ariaSnapshot: ''
    }

    switch (type) {
        case 'click':
            return {
                name: 'click',
                button: 'left',
                modifiers: 0,
                clickCount: 1,
                ...baseWithSelector,
                signals: []
            } as ClickAction
        case 'hover':
            return { name: 'hover', ...baseWithSelector, signals: [] } as HoverAction
        case 'check':
            return { name: 'check', ...baseWithSelector, signals: [] } as CheckAction
        case 'uncheck':
            return { name: 'uncheck', ...baseWithSelector, signals: [] } as UncheckAction
        case 'fill':
            return { name: 'fill', text: '', ...baseWithSelector, signals: [] } as FillAction
        case 'press':
            return { name: 'press', key: '', modifiers: 0, ...baseWithSelector, signals: [] } as PressAction
        case 'select':
            return { name: 'select', options: [], ...baseWithSelector, signals: [] } as SelectAction
        case 'setInputFiles':
            return { name: 'setInputFiles', files: [], ...baseWithSelector, signals: [] } as SetInputFilesAction
        case 'navigate':
            return { name: 'navigate', url: '', signals: [] }
        case 'openPage':
            return { name: 'openPage', url: '', signals: [] }
        case 'closePage':
            return { name: 'closePage', signals: [] }
        case 'assertText':
            return { name: 'assertText', text: '', substring: false, ...baseWithSelector, signals: [] } as AssertTextAction
        case 'assertValue':
            return { name: 'assertValue', value: '', ...baseWithSelector, signals: [] } as AssertValueAction
        case 'assertChecked':
            return { name: 'assertChecked', checked: true, ...baseWithSelector, signals: [] } as AssertCheckedAction
        case 'assertVisible':
            return { name: 'assertVisible', ...baseWithSelector, signals: [] }
        case 'assertSnapshot':
            return { name: 'assertSnapshot', ...baseWithSelector, signals: [] }
        default:
            return { name: 'click', button: 'left', modifiers: 0, clickCount: 1, ...baseWithSelector, signals: [] } as ClickAction
    }
}

// Available action types for the dropdown
const actionTypes = [
    { value: 'click', label: 'Click' },
    { value: 'hover', label: 'Hover' },
    { value: 'check', label: 'Check' },
    { value: 'uncheck', label: 'Uncheck' },
    { value: 'fill', label: 'Fill' },
    { value: 'press', label: 'Press' },
    { value: 'select', label: 'Select' },
    { value: 'setInputFiles', label: 'Set Input Files' },
    { value: 'navigate', label: 'Navigate' },
    { value: 'openPage', label: 'Open Page' },
    { value: 'closePage', label: 'Close Page' },
    { value: 'assertText', label: 'Assert Text' },
    { value: 'assertValue', label: 'Assert Value' },
    { value: 'assertChecked', label: 'Assert Checked' },
    { value: 'assertVisible', label: 'Assert Visible' },
    { value: 'assertSnapshot', label: 'Assert Snapshot' }
]

// Check if action has selector field
const hasSelector = (action: TPlaywrightAction): boolean => {
    return !['navigate', 'openPage', 'closePage'].includes(action.name)
}

// Check if action has signals
const hasSignals = (action: TPlaywrightAction): boolean => {
    return true // All actions can have signals now
}

function PlaywrightSheet({ action, onUpdate }: TPlaywrightSheetProps) {
    // Internal state for the form
    const [formData, setFormData] = useState<TPlaywrightAction | null>(action)

    // Update internal state when prop action changes
    // useEffect(() => {
    //     if (action) {
    //         setFormData(action)
    //     }
    // }, [])

    if (!formData) return null

    const handleActionTypeChange = (newType: string) => {
        const newAction = getDefaultAction(newType)
        setFormData(newAction)
    }

    const handleFieldChange = (field: string, value: unknown) => {
        const updated = { ...formData, [field]: value } as TPlaywrightAction
        setFormData(updated)
    }

    const handleSave = () => {
        if (formData) {
            onUpdate(formData)
        }
    }

    // Render selector field for actions that need it
    const renderSelectorField = () => {
        if (!hasSelector(formData)) return null

        const actionWithSelector = formData as ActionWithSelector
        return (
            <div className="space-y-2">
                <Label htmlFor="selector">Selector</Label>
                <Input
                    id="selector"
                    value={actionWithSelector.selector || ''}
                    onChange={(e) => handleFieldChange('selector', e.target.value)}
                    placeholder="CSS selector or XPath"
                />
                <p className="text-xs text-muted-foreground">Example: #id, .class, [data-testid="element"]</p>
            </div>
        )
    }

    // Render signals field (simplified for now)
    const renderSignalsField = () => {
        if (!hasSignals(formData)) return null

        return (
            <div className="space-y-2">
                <Label>Signals</Label>
                <div className="p-3 border rounded-md bg-muted/30">
                    <p className="text-xs text-muted-foreground">Signal configuration coming soon</p>
                </div>
            </div>
        )
    }

    // Render different forms based on action type
    const renderActionForm = () => {
        switch (formData.name) {
            case 'click':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="button">Button</Label>
                            <Select
                                value={(formData as ClickAction).button}
                                onValueChange={(value) => handleFieldChange('button', value)}>
                                <SelectTrigger id="button">
                                    <SelectValue placeholder="Select button" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="middle">Middle</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="clickCount">Click Count</Label>
                            <Input
                                id="clickCount"
                                type="number"
                                min="1"
                                value={(formData as ClickAction).clickCount}
                                onChange={(e) => handleFieldChange('clickCount', parseInt(e.target.value))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modifiers">Modifiers</Label>
                            <Select
                                value={String((formData as ClickAction).modifiers)}
                                onValueChange={(value) => handleFieldChange('modifiers', parseInt(value))}>
                                <SelectTrigger id="modifiers">
                                    <SelectValue placeholder="Select modifier" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">None</SelectItem>
                                    <SelectItem value="1">Ctrl/Cmd</SelectItem>
                                    <SelectItem value="2">Alt</SelectItem>
                                    <SelectItem value="4">Shift</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )

            case 'fill':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="text">Text to Fill</Label>
                            <Input
                                id="text"
                                value={(formData as FillAction).text}
                                onChange={(e) => handleFieldChange('text', e.target.value)}
                                placeholder="Enter text..."
                            />
                        </div>
                    </div>
                )

            case 'press':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="key">Key</Label>
                            <Input
                                id="key"
                                value={(formData as PressAction).key}
                                onChange={(e) => handleFieldChange('key', e.target.value)}
                                placeholder="Enter key (e.g., Enter, Tab, Space)"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modifiers">Modifiers</Label>
                            <Select
                                value={String((formData as PressAction).modifiers)}
                                onValueChange={(value) => handleFieldChange('modifiers', parseInt(value))}>
                                <SelectTrigger id="modifiers">
                                    <SelectValue placeholder="Select modifier" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">None</SelectItem>
                                    <SelectItem value="1">Ctrl/Cmd</SelectItem>
                                    <SelectItem value="2">Alt</SelectItem>
                                    <SelectItem value="4">Shift</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )

            case 'select':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="options">Options</Label>
                            <Input
                                id="options"
                                value={(formData as SelectAction).options.join(', ')}
                                onChange={(e) =>
                                    handleFieldChange(
                                        'options',
                                        e.target.value.split(',').map((s) => s.trim())
                                    )
                                }
                                placeholder="Enter options separated by commas"
                            />
                            <p className="text-xs text-muted-foreground">Example: option1, option2, option3</p>
                        </div>
                    </div>
                )

            case 'setInputFiles':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="files">Files</Label>
                            <Input
                                id="files"
                                value={(formData as SetInputFilesAction).files.join(', ')}
                                onChange={(e) =>
                                    handleFieldChange(
                                        'files',
                                        e.target.value.split(',').map((s) => s.trim())
                                    )
                                }
                                placeholder="Enter file paths separated by commas"
                            />
                            <p className="text-xs text-muted-foreground">Example: file1.pdf, file2.jpg, /path/to/file3.txt</p>
                        </div>
                    </div>
                )

            case 'navigate':
            case 'openPage':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="url">URL</Label>
                            <Input
                                id="url"
                                type="url"
                                value={formData.url}
                                onChange={(e) => handleFieldChange('url', e.target.value)}
                                placeholder="https://example.com"
                            />
                        </div>
                    </div>
                )

            case 'assertText':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="text">Expected Text</Label>
                            <Input
                                id="text"
                                value={(formData as AssertTextAction).text}
                                onChange={(e) => handleFieldChange('text', e.target.value)}
                                placeholder="Text to assert"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="substring">Check as Substring</Label>
                            <Switch
                                id="substring"
                                checked={(formData as AssertTextAction).substring}
                                onCheckedChange={(checked) => handleFieldChange('substring', checked)}
                            />
                        </div>
                    </div>
                )

            case 'assertValue':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="value">Expected Value</Label>
                            <Input
                                id="value"
                                value={(formData as AssertValueAction).value}
                                onChange={(e) => handleFieldChange('value', e.target.value)}
                                placeholder="Expected input value"
                            />
                        </div>
                    </div>
                )

            case 'assertChecked':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="flex items-center justify-between">
                            <Label htmlFor="checked">Expected State</Label>
                            <Switch
                                id="checked"
                                checked={(formData as AssertCheckedAction).checked}
                                onCheckedChange={(checked) => handleFieldChange('checked', checked)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">ON = Checked, OFF = Unchecked</p>
                    </div>
                )

            case 'assertVisible':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}
                        <div className="p-3 text-center text-muted-foreground bg-muted/50 rounded-md">
                            Asserts that the element is visible on the page
                        </div>
                    </div>
                )

            case 'assertSnapshot':
                return (
                    <div className="space-y-4">
                        {renderSelectorField()}

                        <div className="space-y-2">
                            <Label htmlFor="ariaSnapshot">ARIA Snapshot</Label>
                            <Textarea
                                id="ariaSnapshot"
                                value={formData.ariaSnapshot || ''}
                                onChange={(e) => handleFieldChange('ariaSnapshot', e.target.value)}
                                placeholder="Expected ARIA snapshot structure"
                                rows={5}
                            />
                            <p className="text-xs text-muted-foreground">Define the expected ARIA structure for snapshot testing</p>
                        </div>
                    </div>
                )

            case 'hover':
            case 'check':
            case 'uncheck':
            case 'closePage':
                return (
                    <div className="space-y-4">
                        {hasSelector(formData) && renderSelectorField()}
                        <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-md">
                            No additional configuration needed for {formData.name} action
                        </div>
                    </div>
                )

            default:
                return <div className="text-muted-foreground">Unknown action type</div>
        }
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

            {renderActionForm()}

            {renderSignalsField()}

            <Button
                onClick={handleSave}
                className="w-full">
                Update Action
            </Button>
        </div>
    )
}

export default PlaywrightSheet
