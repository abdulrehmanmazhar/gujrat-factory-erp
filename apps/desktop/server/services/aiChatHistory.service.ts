import { getClient } from '../utils/db.js'
import { createId } from '../utils/mappers.js'
import { AppError } from '../utils/errors.js'
import type { AiChatResponse } from './ai/schemas.js'
import { AiChatResponseSchema } from './ai/schemas.js'

const DEFAULT_TITLE = 'New chat'
const MAX_HISTORY_TURNS = 20

type SessionRow = {
    id: string
    user_id: string
    title: string
    created_at: number
    updated_at: number
}

type MessageRow = {
    id: string
    session_id: string
    role: string
    content: string
    response_json: string | null
    created_at: number
}

export type AiChatSessionSummary = {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messageCount: number
    preview: string | null
}

export type AiChatMessageRecord = {
    id: string
    role: 'user' | 'assistant'
    content: string
    response: AiChatResponse | null
    createdAt: string
}

export type AiChatSessionDetail = {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messages: AiChatMessageRecord[]
}

function titleFromMessage(message: string) {
    const trimmed = message.trim().replace(/\s+/g, ' ')
    if (!trimmed) return DEFAULT_TITLE
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed
}

function mapSession(row: SessionRow, messageCount = 0, preview: string | null = null): AiChatSessionSummary {
    return {
        id: row.id,
        title: row.title,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        messageCount,
        preview
    }
}

function parseStoredResponse(raw: string | null): AiChatResponse | null {
    if (!raw) return null
    try {
        return AiChatResponseSchema.parse(JSON.parse(raw))
    } catch {
        return null
    }
}

function mapMessage(row: MessageRow): AiChatMessageRecord {
    const role = row.role === 'user' ? 'user' : 'assistant'
    return {
        id: row.id,
        role,
        content: row.content,
        response: parseStoredResponse(row.response_json),
        createdAt: new Date(row.created_at).toISOString()
    }
}

async function getSessionRow(userId: string, sessionId: string): Promise<SessionRow> {
    const client = getClient()
    const result = await client.execute({
        sql: 'SELECT id, user_id, title, created_at, updated_at FROM ai_chat_sessions WHERE id = ? AND user_id = ? LIMIT 1',
        args: [sessionId, userId]
    })
    const row = result.rows[0] as unknown as SessionRow | undefined
    if (!row) throw new AppError('Chat session not found', 404)
    return row
}

export async function listAiChatSessions(userId: string): Promise<AiChatSessionSummary[]> {
    const client = getClient()
    const result = await client.execute({
        sql: `
            SELECT
                s.id,
                s.user_id,
                s.title,
                s.created_at,
                s.updated_at,
                COUNT(m.id) AS message_count,
                (
                    SELECT m2.content
                    FROM ai_chat_messages m2
                    WHERE m2.session_id = s.id
                    ORDER BY m2.created_at DESC
                    LIMIT 1
                ) AS preview
            FROM ai_chat_sessions s
            LEFT JOIN ai_chat_messages m ON m.session_id = s.id
            WHERE s.user_id = ?
            GROUP BY s.id
            ORDER BY s.updated_at DESC
        `,
        args: [userId]
    })

    return result.rows.map((row) => {
        const session = row as unknown as SessionRow & { message_count?: number; preview?: string | null }
        return mapSession(session, Number(session.message_count ?? 0), session.preview ?? null)
    })
}

export async function createAiChatSession(userId: string, title = DEFAULT_TITLE) {
    const client = getClient()
    const now = Date.now()
    const id = createId()

    await client.execute({
        sql: 'INSERT INTO ai_chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        args: [id, userId, title, now, now]
    })

    return mapSession({ id, user_id: userId, title, created_at: now, updated_at: now })
}

export async function getAiChatSession(userId: string, sessionId: string): Promise<AiChatSessionDetail> {
    const session = await getSessionRow(userId, sessionId)
    const client = getClient()
    const result = await client.execute({
        sql: `
            SELECT id, session_id, role, content, response_json, created_at
            FROM ai_chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
        `,
        args: [sessionId]
    })

    const messages = result.rows.map((row) => mapMessage(row as unknown as MessageRow))

    return {
        id: session.id,
        title: session.title,
        createdAt: new Date(session.created_at).toISOString(),
        updatedAt: new Date(session.updated_at).toISOString(),
        messages
    }
}

export async function deleteAiChatSession(userId: string, sessionId: string) {
    await getSessionRow(userId, sessionId)
    const client = getClient()
    await client.execute({ sql: 'DELETE FROM ai_chat_sessions WHERE id = ? AND user_id = ?', args: [sessionId, userId] })
}

export async function resolveAiChatSession(userId: string, sessionId?: string) {
    if (sessionId) {
        await getSessionRow(userId, sessionId)
        return sessionId
    }
    const created = await createAiChatSession(userId)
    return created.id
}

export async function addAiChatMessage(sessionId: string, role: 'user' | 'assistant', content: string, response?: AiChatResponse | null) {
    const client = getClient()
    const now = Date.now()
    const id = createId()
    const responseJson = response ? JSON.stringify(response) : null

    await client.execute({
        sql: 'INSERT INTO ai_chat_messages (id, session_id, role, content, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, sessionId, role, content, responseJson, now]
    })

    await client.execute({
        sql: 'UPDATE ai_chat_sessions SET updated_at = ? WHERE id = ?',
        args: [now, sessionId]
    })

    return mapMessage({
        id,
        session_id: sessionId,
        role,
        content,
        response_json: responseJson,
        created_at: now
    })
}

export async function maybeRenameSessionFromFirstMessage(sessionId: string, message: string) {
    const client = getClient()
    const result = await client.execute({
        sql: 'SELECT title FROM ai_chat_sessions WHERE id = ? LIMIT 1',
        args: [sessionId]
    })
    const title = String((result.rows[0] as { title?: string } | undefined)?.title ?? '')
    if (title !== DEFAULT_TITLE) return

    await client.execute({
        sql: 'UPDATE ai_chat_sessions SET title = ?, updated_at = ? WHERE id = ?',
        args: [titleFromMessage(message), Date.now(), sessionId]
    })
}

export async function buildAiHistoryFromSession(sessionId: string) {
    const client = getClient()
    const result = await client.execute({
        sql: `
            SELECT id, session_id, role, content, response_json, created_at
            FROM ai_chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
        `,
        args: [sessionId]
    })

    const messages = result.rows.map((row) => mapMessage(row as unknown as MessageRow))

    return messages.slice(-MAX_HISTORY_TURNS).map((message) => {
        if (message.role === 'assistant' && message.response?.charts?.length) {
            const chartTitles = message.response.charts.map((chart) => chart.title).join(', ')
            return {
                role: 'assistant' as const,
                content: `${message.content}\n[Charts: ${chartTitles}]`
            }
        }
        return { role: message.role, content: message.content }
    })
}

export async function runPersistedAiChat(userId: string, sessionId: string | undefined, message: string) {
    const resolvedSessionId = await resolveAiChatSession(userId, sessionId)
    const userMessage = await addAiChatMessage(resolvedSessionId, 'user', message)
    await maybeRenameSessionFromFirstMessage(resolvedSessionId, message)

    const history = await buildAiHistoryFromSession(resolvedSessionId)
    const historyWithoutLatest = history.slice(0, -1)

    return {
        sessionId: resolvedSessionId,
        userMessage,
        history: historyWithoutLatest
    }
}

export async function saveAssistantAiChatMessage(sessionId: string, content: string, response: AiChatResponse) {
    return addAiChatMessage(sessionId, 'assistant', content, response)
}

export async function saveAssistantErrorMessage(sessionId: string, content: string) {
    return addAiChatMessage(sessionId, 'assistant', content, null)
}
