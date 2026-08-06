import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { AiChatSessionSummary } from '@/redux/api/aiApi'
import { Loader2, MessageSquarePlus, Trash2 } from 'lucide-react'

function formatRelativeTime(iso: string) {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
}

export function AiChatSidebar({
    sessions,
    activeSessionId,
    loading,
    deletingSessionId,
    onSelectSession,
    onNewChat,
    onDeleteSession
}: {
    sessions: AiChatSessionSummary[]
    activeSessionId: string | null
    loading?: boolean
    deletingSessionId?: string | null
    onSelectSession: (sessionId: string) => void
    onNewChat: () => void
    onDeleteSession: (sessionId: string) => void
}) {
    return (
        <div className="flex h-full min-h-0 w-72 shrink-0 flex-col rounded-lg border bg-card">
            <div className="border-b p-3">
                <Button
                    type="button"
                    className="w-full justify-start"
                    variant="outline"
                    onClick={onNewChat}>
                    <MessageSquarePlus className="mr-2 size-4" />
                    New chat
                </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-1 p-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Loading chats…
                        </div>
                    ) : sessions.length === 0 ? (
                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No conversations yet. Start a new chat to analyze your ERP data.
                        </p>
                    ) : (
                        sessions.map((session) => {
                            const active = activeSessionId === session.id
                            return (
                                <div
                                    key={session.id}
                                    className={cn(
                                        'group flex items-start gap-2 rounded-md px-2 py-2 transition-colors',
                                        active ? 'bg-primary/10' : 'hover:bg-muted'
                                    )}>
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={() => onSelectSession(session.id)}>
                                        <p className="truncate text-sm font-medium">{session.title}</p>
                                        {session.preview ? <p className="truncate text-xs text-muted-foreground">{session.preview}</p> : null}
                                        <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(session.updatedAt)}</p>
                                    </button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                        disabled={deletingSessionId === session.id}
                                        onClick={() => onDeleteSession(session.id)}>
                                        {deletingSessionId === session.id ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="size-3.5" />
                                        )}
                                    </Button>
                                </div>
                            )
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
