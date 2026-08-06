import { useEffect, useMemo, useRef, useState } from 'react'
import { AiChatSidebar } from '@/components/ai/AiChatSidebar'
import { AnalyticsChart } from '@/components/ai/AnalyticsChart'
import { GeminiApiKeyDialog } from '@/components/ai/GeminiApiKeyDialog'
import { GeminiModelSelect } from '@/components/ai/GeminiModelSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { getApiErrorMessage } from '@/lib/errors'
import type { AiChatResponse } from '@/lib/aiSchemas'
import {
    useDeleteAiSessionMutation,
    useGetAiSessionQuery,
    useGetAiSessionsQuery,
    useGetGeminiKeyStatusQuery,
    useGetGeminiModelsQuery,
    useRemoveGeminiApiKeyMutation,
    useSaveGeminiModelMutation,
    useSendAiChatMutation
} from '@/redux/api/aiApi'
import { Bot, KeyRound, Loader2, LogOut, Send, User } from 'lucide-react'
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
    const { data: geminiStatus, isLoading: loadingStatus } = useGetGeminiKeyStatusQuery()
    const { data: sessionsData, isLoading: loadingSessions } = useGetAiSessionsQuery()
    const { data: modelsData } = useGetGeminiModelsQuery(undefined, {
        skip: !geminiStatus?.configured
    })

    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [initializedSelection, setInitializedSelection] = useState(false)
    const [keyDialogOpen, setKeyDialogOpen] = useState(false)
    const [input, setInput] = useState('')
    const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([])
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

    const { data: sessionData, isFetching: loadingSession } = useGetAiSessionQuery(activeSessionId ?? '', {
        skip: !activeSessionId
    })

    const [removeKey, { isLoading: removingKey }] = useRemoveGeminiApiKeyMutation()
    const [saveModel, { isLoading: savingModel }] = useSaveGeminiModelMutation()
    const [deleteSession] = useDeleteAiSessionMutation()
    const [sendChat, { isLoading: sending }] = useSendAiChatMutation()

    const bottomRef = useRef<HTMLDivElement>(null)
    const configured = Boolean(geminiStatus?.configured)
    const model = geminiStatus?.model ?? 'gemini-2.5-flash'
    const models = modelsData?.models ?? []
    const sessions = sessionsData?.sessions ?? []

    useEffect(() => {
        if (!loadingStatus && !configured) {
            setKeyDialogOpen(true)
        }
    }, [loadingStatus, configured])

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

    const handleModelChange = async (nextModel: string) => {
        if (nextModel === model || savingModel) return
        try {
            await saveModel({ model: nextModel }).unwrap()
            toast.success('Gemini model updated')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not update model'))
        }
    }

    const handleRemoveKey = async () => {
        try {
            await removeKey().unwrap()
            toast.success('Gemini API key removed')
            setKeyDialogOpen(true)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not remove API key'))
        }
    }

    const handleSend = async () => {
        const text = input.trim()
        if (!text || sending) return

        if (!configured) {
            setKeyDialogOpen(true)
            toast.error('Add your Gemini API key first')
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
                    description="Business intelligence powered by Google Gemini — query your ERP data in natural language"
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            {configured ? (
                                <>
                                    <GeminiModelSelect
                                        models={models}
                                        value={model}
                                        onValueChange={(next) => void handleModelChange(next)}
                                        disabled={savingModel || models.length === 0}
                                    />
                                    <Badge variant="secondary">Key saved</Badge>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setKeyDialogOpen(true)}>
                                        <KeyRound className="mr-2 size-4" />
                                        Change key
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={removingKey}
                                        onClick={() => void handleRemoveKey()}>
                                        <LogOut className="mr-2 size-4" />
                                        Remove key
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => setKeyDialogOpen(true)}>
                                    <KeyRound className="mr-2 size-4" />
                                    Add Gemini API key
                                </Button>
                            )}
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
                                            : 'Add your Gemini API key to start chatting'
                                    }
                                    disabled={!configured || sending}
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
                                    disabled={!configured || sending || !input.trim()}
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
                onOpenChange={setKeyDialogOpen}
                initialModel={model}
                required={!configured}
            />
        </>
    )
}
