import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GeminiModelSelect } from '@/components/ai/GeminiModelSelect'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetGeminiModelsPublicQuery, useSaveGeminiApiKeyMutation } from '@/redux/api/aiApi'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey'
const DEFAULT_MODEL = 'gemini-2.5-flash'

function openExternalUrl(url: string) {
    const os = window.platform?.os as { open?: (target: string) => Promise<void> } | undefined
    if (window.platform?.type === 'neutralino' && typeof os?.open === 'function') {
        void os.open(url)
        return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
}

export function GeminiApiKeyDialog({
    open,
    onOpenChange,
    initialModel = DEFAULT_MODEL,
    required = false
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialModel?: string
    required?: boolean
}) {
    const { data: modelsData } = useGetGeminiModelsPublicQuery()
    const [apiKey, setApiKey] = useState('')
    const [model, setModel] = useState(initialModel)
    const [saveKey, { isLoading }] = useSaveGeminiApiKeyMutation()

    const models = modelsData?.models ?? []

    useEffect(() => {
        if (open) setModel(initialModel)
    }, [open, initialModel])

    const handleSave = async () => {
        const trimmed = apiKey.trim()
        if (!trimmed) {
            toast.error('Enter your Gemini API key')
            return
        }

        try {
            await saveKey({ apiKey: trimmed, model }).unwrap()
            setApiKey('')
            toast.success('Gemini API key saved')
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not save API key'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (required && !next) return
                onOpenChange(next)
            }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Gemini API key</DialogTitle>
                    <DialogDescription>
                        Use your own Google AI Studio API key. Choose a Gemini model and your analytics requests will use your quota.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="gemini-model">Model</Label>
                        <GeminiModelSelect
                            models={models}
                            value={model}
                            onValueChange={setModel}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="gemini-api-key">API key</Label>
                        <Input
                            id="gemini-api-key"
                            type="password"
                            autoComplete="off"
                            placeholder="AIza..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleSave()
                            }}
                        />
                    </div>

                    <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => openExternalUrl(GEMINI_KEY_URL)}>
                        Get a key from Google AI Studio
                        <ExternalLink className="ml-2 size-4" />
                    </Button>
                </div>

                <DialogFooter>
                    {!required ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        disabled={isLoading || !apiKey.trim()}
                        onClick={() => void handleSave()}>
                        {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        Save key
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
