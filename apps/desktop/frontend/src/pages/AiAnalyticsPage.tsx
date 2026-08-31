import { useEffect, useMemo, useRef, useState } from 'react'
import { AiChatSidebar } from '@/components/ai/AiChatSidebar'
import { AnalyticsChart } from '@/components/ai/AnalyticsChart'
import { GeminiApiKeyDialog } from '@/components/ai/GeminiApiKeyDialog'
import { GeminiModelSelect } from '@/components/ai/GeminiModelSelect'
import { OllamaSetupDialog } from '@/components/ai/OllamaSetupDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import type { AiChatResponse } from '@/lib/aiSchemas'
import { usePermissions } from '@/hooks/usePermissions'
import {
    useDeleteAiSessionMutation,
    useGetAiProviderStatusQuery,
    useGetAiSessionQuery,
    useGetAiSessionsQuery,
    useGetGeminiModelsQuery,
    useRemoveGeminiApiKeyMutation,
    useSaveGeminiModelMutation,
    useSaveOllamaSettingsMutation,
    useSendAiChatMutation,
    useSetAiProviderMutation,
    type AiProvider
} from '@/redux/api/aiApi'
import { Bot, KeyRound, Loader2, LogOut, Server, Send, User } from 'lucide-react'
import { toast } from 'sonner'

const WELCOME_MESSAGE =
    'Ask me about sales, inventory, customers, suppliers, payments, or factory KPIs. I will query your ERP database and build charts for you.'

type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    response?: AiChatResponse | null
}

function mapStoredMessages(
    messages: Array<{
        id: string
        role: 'user' | 'assistant'
        content: string
        response: AiChatResponse | null
    }>
): ChatMessage[] {
    return messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        response: message.response
    }))
}

export default function AiAnalyticsPage() {
    const { canWrite, canDelete } = usePermissions()
    const {
        data: providerStatus,
        isLoading: loadingStatus,
        refetch: refetchProvider
    } = useGetAiProviderStatusQuery({
        probeOllama: true
    })
    const { data: sessionsData, isLoading: loadingSessions } = useGetAiSessionsQuery()

    const provider: AiProvider = providerStatus?.provider ?? 'gemini'
    const geminiConfigured = Boolean(providerStatus?.gemini.configured)
    const ollamaConfigured = Boolean(providerStatus?.ollama.configured && providerStatus?.ollama.reachable !== false)
    const configured = provider === 'gemini' ? geminiConfigured : Boolean(providerStatus?.ollama.model)

    const { data: geminiModelsData } = useGetGeminiModelsQuery(undefined, {
        skip: provider !== 'gemini' || !geminiConfigured
    })

    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [initializedSelection, setInitializedSelection] = useState(false)
    const [keyDialogOpen, setKeyDialogOpen] = useState(false)
    const [keyPromptDismissed, setKeyPromptDismissed] = useState(false)
    const [ollamaDialogOpen, setOllamaDialogOpen] = useState(false)
    const [ollamaPromptDismissed, setOllamaPromptDismissed] = useState(false)
    const [input, setInput] = useState('')
    const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([])
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

    const { data: sessionData, isFetching: loadingSession } = useGetAiSessionQuery(activeSessionId ?? '', {
        skip: !activeSessionId
    })

    const [setProvider, { isLoading: switchingProvider }] = useSetAiProviderMutation()
    const [removeKey, { isLoading: removingKey }] = useRemoveGeminiApiKeyMutation()
    const [saveGeminiModel, { isLoading: savingGeminiModel }] = useSaveGeminiModelMutation()
    const [saveOllama, { isLoading: savingOllamaModel }] = useSaveOllamaSettingsMutation()
    const [deleteSession] = useDeleteAiSessionMutation()
    const [sendChat, { isLoading: sending }] = useSendAiChatMutation()

    const bottomRef = useRef<HTMLDivElement>(null)
    const geminiModel = providerStatus?.gemini.model ?? 'gemini-2.5-flash'
    const ollamaModel = providerStatus?.ollama.model ?? ''
    const ollamaBaseUrl = providerStatus?.ollama.baseUrl ?? providerStatus?.ollama.displayUrl ?? 'http://127.0.0.1:11434'
    const ollamaDisplayUrl = providerStatus?.ollama.displayUrl ?? ollamaBaseUrl
    const geminiModels = geminiModelsData?.models ?? []
    const ollamaModels = providerStatus?.ollama.models ?? []
    const sessions = sessionsData?.sessions ?? []
    const activeModel = provider === 'gemini' ? geminiModel : ollamaModel || 'No model'

    useEffect(() => {
        if (loadingStatus) return
        if (provider === 'gemini' && !geminiConfigured && !keyPromptDismissed) setKeyDialogOpen(true)
        if (provider === 'ollama' && !configured && !ollamaPromptDismissed) setOllamaDialogOpen(true)
    }, [loadingStatus, provider, geminiConfigured, configured, keyPromptDismissed, ollamaPromptDismissed])

    useEffect(() => {
        if (geminiConfigured) setKeyPromptDismissed(false)
    }, [geminiConfigured])

    useEffect(() => {
        if (configured && provider === 'ollama') setOllamaPromptDismissed(false)
    }, [configured, provider])

    useEffect(() => {
        if (initializedSelection || loadingSessions) return
        if (sessions.length > 0) {
            setActiveSessionId(sessions[0].id)
        }
        setInitializedSelection(true)
    }, [initializedSelection, loadingSessions, sessions])

    const persistedMessages = useMemo(() => {
        if (!activeSessionId || !sessionData?.session) return []
        return mapStoredMessages(sessionData.session.messages)
    }, [activeSessionId, sessionData])

    const messages = useMemo(() => {
        const base =
            persistedMessages.length > 0
                ? persistedMessages
                : activeSessionId
                  ? []
                  : [{ id: 'welcome', role: 'assistant' as const, content: WELCOME_MESSAGE }]
        return [...base, ...pendingMessages]
    }, [persistedMessages, pendingMessages, activeSessionId])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, sending])

    const handleNewChat = () => {
        setActiveSessionId(null)
        setPendingMessages([])
        setInput('')
    }

    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId)
        setPendingMessages([])
        setInput('')
    }

    const handleDeleteSession = async (sessionId: string) => {
        setDeletingSessionId(sessionId)
        try {
            await deleteSession(sessionId).unwrap()
            if (activeSessionId === sessionId) {
                handleNewChat()
            }
            toast.success('Chat deleted')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete chat'))
        } finally {
            setDeletingSessionId(null)
        }
    }

    const handleProviderChange = async (next: AiProvider) => {
        if (next === provider || switchingProvider) return
        try {
            await setProvider({ provider: next }).unwrap()
            toast.success(next === 'gemini' ? 'Using Gemini' : 'Using local Ollama')
            if (next === 'gemini' && !geminiConfigured) {
                setKeyPromptDismissed(false)
                setKeyDialogOpen(true)
            }
            if (next === 'ollama' && !ollamaConfigured) {
                setOllamaPromptDismissed(false)
                setOllamaDialogOpen(true)
            }
            void refetchProvider()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not switch provider'))
        }
    }

    const handleGeminiModelChange = async (nextModel: string) => {
        if (nextModel === geminiModel || savingGeminiModel) return
        try {
            await saveGeminiModel({ model: nextModel }).unwrap()
            toast.success('Gemini model updated')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not update model'))
        }
    }

    const handleOllamaModelChange = async (nextModel: string) => {
        if (nextModel === ollamaModel || savingOllamaModel) return
        try {
            await saveOllama({ baseUrl: ollamaBaseUrl, model: nextModel, setActive: true }).unwrap()
            toast.success('Ollama model updated')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not update Ollama model'))
        }
    }

    const handleRemoveKey = async () => {
        try {
            await removeKey().unwrap()
            toast.success('Gemini API key removed')
            setKeyPromptDismissed(false)
            setKeyDialogOpen(true)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not remove API key'))
        }
    }

    const handleSend = async () => {
        const text = input.trim()
        if (!text || sending) return

        if (!configured) {
            if (provider === 'gemini') {
                setKeyDialogOpen(true)
                toast.error('Add your Gemini API key first')
            } else {
                setOllamaDialogOpen(true)
                toast.error('Configure local Ollama first')
            }
            return
        }

        const optimisticUser: ChatMessage = { id: `pending-user-${Date.now()}`, role: 'user', content: text }
        setPendingMessages((prev) => [...prev, optimisticUser])
        setInput('')

        try {
            const result = await sendChat({
                message: text,
                sessionId: activeSessionId ?? undefined
            }).unwrap()

            if (!activeSessionId) {
                setActiveSessionId(result.sessionId)
            }

            if (result.error) {
                toast.error(result.error)
            }

            setPendingMessages([])
        } catch (err) {
            setPendingMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id))
            toast.error(getApiErrorMessage(err, 'AI request failed'))
        }
    }

    const showWelcome = !activeSessionId && pendingMessages.length === 0
    const showLoadingConversation = Boolean(activeSessionId && loadingSession && persistedMessages.length === 0)

    return (
        <>
            <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
                <PageHeader
                    title="AI Analytics"
                    description="Query your ERP with Google Gemini or a local Ollama model"
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <Select
                                value={provider}
                                onValueChange={(value) => void handleProviderChange(value as AiProvider)}
                                disabled={!canWrite || switchingProvider}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gemini">Gemini</SelectItem>
                                    <SelectItem value="ollama">Ollama</SelectItem>
                                </SelectContent>
                            </Select>

                            {provider === 'gemini' ? (
                                configured ? (
                                    <>
                                        <GeminiModelSelect
                                            models={geminiModels}
                                            value={geminiModel}
                                            onValueChange={(next) => void handleGeminiModelChange(next)}
                                            disabled={!canWrite || savingGeminiModel || geminiModels.length === 0}
                                        />
                                        <Badge variant="secondary">Key saved</Badge>
                                        {canWrite ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setKeyDialogOpen(true)}>
                                                <KeyRound className="mr-2 size-4" />
                                                Change key
                                            </Button>
                                        ) : null}
                                        {canDelete ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={removingKey}
                                                onClick={() => void handleRemoveKey()}>
                                                <LogOut className="mr-2 size-4" />
                                                Remove key
                                            </Button>
                                        ) : null}
                                    </>
                                ) : canWrite ? (
                                    <Button
                                        size="sm"
                                        onClick={() => setKeyDialogOpen(true)}>
                                        <KeyRound className="mr-2 size-4" />
                                        Add Gemini API key
                                    </Button>
                                ) : null
                            ) : configured ? (
                                <>
                                    <GeminiModelSelect
                                        models={ollamaModels}
                                        value={ollamaModel}
                                        onValueChange={(next) => void handleOllamaModelChange(next)}
                                        disabled={!canWrite || savingOllamaModel || ollamaModels.length === 0}
                                    />
                                    <Badge
                                        variant="secondary"
                                        className="max-w-[220px] truncate"
                                        title={ollamaDisplayUrl}>
                                        {ollamaDisplayUrl}
                                    </Badge>
                                    {canWrite ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setOllamaDialogOpen(true)}>
                                            <Server className="mr-2 size-4" />
                                            Ollama settings
                                        </Button>
                                    ) : null}
                                </>
                            ) : canWrite ? (
                                <Button
                                    size="sm"
                                    onClick={() => setOllamaDialogOpen(true)}>
                                    <Server className="mr-2 size-4" />
                                    Connect Ollama
                                </Button>
                            ) : null}
                        </div>
                    }
                />

                <div className="flex min-h-0 flex-1 gap-4">
                    <AiChatSidebar
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        loading={loadingSessions}
                        deletingSessionId={deletingSessionId}
                        onSelectSession={handleSelectSession}
                        onNewChat={handleNewChat}
                        onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
                    />

                    <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                            <div className="text-xs text-muted-foreground">
                                Active: {provider === 'gemini' ? 'Gemini' : 'Ollama'} · {activeModel}
                            </div>
                            <ScrollArea className="min-h-0 flex-1 pr-3">
                                <div className="space-y-4">
                                    {showWelcome ? (
                                        <div className="flex gap-3">
                                            <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                                                <Bot className="size-4" />
                                            </div>
                                            <div className="max-w-[85%] rounded-lg bg-muted px-4 py-3 text-sm">
                                                <p className="whitespace-pre-wrap">{WELCOME_MESSAGE}</p>
                                            </div>
                                        </div>
                                    ) : null}

                                    {showLoadingConversation ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="size-4 animate-spin" />
                                            Loading conversation…
                                        </div>
                                    ) : null}

                                    {messages
                                        .filter((msg) => msg.id !== 'welcome')
                                        .map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                {msg.role === 'assistant' ? (
                                                    <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                                                        <Bot className="size-4" />
                                                    </div>
                                                ) : null}
                                                <div
                                                    className={`max-w-[85%] space-y-3 rounded-lg px-4 py-3 text-sm ${
                                                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                                    }`}>
                                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    {msg.response?.charts?.length ? (
                                                        <div className="grid gap-4 pt-2 md:grid-cols-2">
                                                            {msg.response.charts.map((chart) => (
                                                                <AnalyticsChart
                                                                    key={chart.id}
                                                                    chart={chart}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                {msg.role === 'user' ? (
                                                    <div className="mt-1 rounded-full bg-muted p-2">
                                                        <User className="size-4" />
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}

                                    {sending ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="size-4 animate-spin" />
                                            Analyzing your ERP data…
                                        </div>
                                    ) : null}
                                    <div ref={bottomRef} />
                                </div>
                            </ScrollArea>

                            <div className="flex gap-2">
                                <Textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={
                                        configured
                                            ? 'e.g. Show monthly sales for the last 3 months as a line chart'
                                            : provider === 'gemini'
                                              ? 'Add your Gemini API key to start chatting'
                                              : 'Connect local Ollama to start chatting'
                                    }
                                    disabled={!configured || sending || !canWrite}
                                    rows={2}
                                    className="min-h-[60px] resize-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            void handleSend()
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    disabled={!configured || sending || !input.trim() || !canWrite}
                                    onClick={() => void handleSend()}
                                    className="self-end">
                                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <GeminiApiKeyDialog
                open={keyDialogOpen}
                onOpenChange={(open) => {
                    setKeyDialogOpen(open)
                    if (!open) setKeyPromptDismissed(true)
                }}
                initialModel={geminiModel}
                required={provider === 'gemini' && !geminiConfigured}
            />
            <OllamaSetupDialog
                open={ollamaDialogOpen}
                onOpenChange={(open) => {
                    setOllamaDialogOpen(open)
                    if (!open) setOllamaPromptDismissed(true)
                }}
                initialBaseUrl={ollamaBaseUrl}
                initialModel={ollamaModel}
                required={provider === 'ollama' && !configured}
            />
        </>
    )
}
