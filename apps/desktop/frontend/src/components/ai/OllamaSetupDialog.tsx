import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GeminiModelSelect } from '@/components/ai/GeminiModelSelect'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetOllamaModelsQuery, useSaveOllamaSettingsMutation, type GeminiModelOption } from '@/redux/api/aiApi'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const OLLAMA_URL = 'https://ollama.com/download'
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434'

function openExternalUrl(url: string) {
    const os = window.platform?.os as { open?: (target: string) => Promise<void> } | undefined
    if (window.platform?.type === 'neutralino' && typeof os?.open === 'function') {
        void os.open(url)
        return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
}

function looksLikeOllamaUrl(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return false
    if (/^\d{1,5}$/.test(trimmed)) {
        const port = Number(trimmed)
        return Number.isInteger(port) && port >= 1 && port <= 65535
    }
    try {
        const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `http://${trimmed}`
        const parsed = new URL(withScheme)
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname)
    } catch {
        return false
    }
}

export function OllamaSetupDialog({
    open,
    onOpenChange,
    initialBaseUrl = DEFAULT_BASE_URL,
    initialModel = '',
    required = false
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialBaseUrl?: string
    initialModel?: string | null
    required?: boolean
}) {
    const [baseUrl, setBaseUrl] = useState(initialBaseUrl || DEFAULT_BASE_URL)
    const [model, setModel] = useState(initialModel ?? '')
    const canProbe = looksLikeOllamaUrl(baseUrl)
    const probeUrl = canProbe ? baseUrl.trim() : undefined

    const { data, isFetching, refetch, error } = useGetOllamaModelsQuery(probeUrl, {
        skip: !open || !probeUrl
    })
    const [saveSettings, { isLoading }] = useSaveOllamaSettingsMutation()

    const models: GeminiModelOption[] = data?.models ?? []

    useEffect(() => {
        if (!open) return
        setBaseUrl(initialBaseUrl || DEFAULT_BASE_URL)
        setModel(initialModel ?? '')
    }, [open, initialBaseUrl, initialModel])

    useEffect(() => {
        if (!open || !models.length) return
        if (!model || !models.some((row) => row.id === model)) {
            setModel(models[0].id)
        }
    }, [open, models, model])

    const handleSave = async () => {
        if (!canProbe) {
            toast.error('Enter a valid Ollama URL (http/https)')
            return
        }
        if (!model) {
            toast.error('Select an Ollama model')
            return
        }
        try {
            await saveSettings({ baseUrl: baseUrl.trim(), model, setActive: true }).unwrap()
            toast.success('Ollama settings saved')
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not connect to Ollama'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ollama connection</DialogTitle>
                    <DialogDescription>
                        Point to any Ollama server URL (local or remote), then pick a model. Examples:{' '}
                        <code className="text-xs">http://127.0.0.1:11434</code>, <code className="text-xs">https://ollama.example.com</code>, or just
                        a port like <code className="text-xs">11434</code> for localhost.
                        {required ? ' You can close this and finish setup later.' : null}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ollama-base-url">Ollama base URL</Label>
                        <div className="flex gap-2">
                            <Input
                                id="ollama-base-url"
                                type="url"
                                placeholder={DEFAULT_BASE_URL}
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!canProbe || isFetching}
                                onClick={() => void refetch()}>
                                {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Must be http:// or https://. Trailing slash is optional.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Available model</Label>
                        <GeminiModelSelect
                            models={models}
                            value={model}
                            onValueChange={setModel}
                            disabled={models.length === 0}
                            className="w-full"
                        />
                        {error ? <p className="text-xs text-destructive">{getApiErrorMessage(error, 'Ollama is not reachable')}</p> : null}
                        {!error && models.length === 0 && !isFetching ? (
                            <p className="text-xs text-muted-foreground">No models found. Pull one with Ollama, then refresh.</p>
                        ) : null}
                    </div>

                    <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => openExternalUrl(OLLAMA_URL)}>
                        Download Ollama
                        <ExternalLink className="ml-2 size-4" />
                    </Button>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={isLoading || !model || !canProbe}
                        onClick={() => void handleSave()}>
                        {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        Use Ollama
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
