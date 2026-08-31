import { AppError } from '../../utils/errors.js'
import { logger } from '../../config/logger.js'
import { runToolCall } from './geminiClient.js'

export type OllamaModelOption = {
    id: string
    name: string
    description?: string
}

export type OllamaChatMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
}

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const REQUEST_TIMEOUT_MS = 120_000

export function normalizeOllamaPort(port?: number | string | null) {
    const value = typeof port === 'string' ? Number(port.trim()) : Number(port ?? 11434)
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new AppError('Ollama port must be an integer between 1 and 65535', 400)
    }
    return value
}

/**
 * Accepts a full http(s) URL, host:port, or bare port (→ http://127.0.0.1:PORT).
 */
export function normalizeOllamaBaseUrl(input?: string | number | null) {
    if (input == null || (typeof input === 'string' && !input.trim())) {
        return DEFAULT_OLLAMA_BASE_URL
    }

    if (typeof input === 'number' || /^\d{1,5}$/.test(String(input).trim())) {
        return `http://127.0.0.1:${normalizeOllamaPort(input)}`
    }

    let raw = String(input).trim()
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
        raw = `http://${raw}`
    }

    let parsed: URL
    try {
        parsed = new URL(raw)
    } catch {
        throw new AppError('Enter a valid Ollama URL (e.g. http://127.0.0.1:11434 or https://ollama.example.com)', 400)
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new AppError('Ollama URL must use http:// or https://', 400)
    }

    if (!parsed.hostname) {
        throw new AppError('Ollama URL must include a hostname', 400)
    }

    parsed.search = ''
    parsed.hash = ''
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    }

    let href = parsed.toString()
    if (parsed.pathname === '/' && href.endsWith('/')) {
        href = href.slice(0, -1)
    }
    return href
}

export function ollamaDisplayHost(baseUrl: string) {
    try {
        const parsed = new URL(normalizeOllamaBaseUrl(baseUrl))
        const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')
        return `${parsed.protocol}//${parsed.host}${path}`
    } catch {
        return baseUrl
    }
}

/** Best-effort port extraction for legacy column sync. */
export function extractOllamaPort(baseUrl: string) {
    try {
        const parsed = new URL(normalizeOllamaBaseUrl(baseUrl))
        if (parsed.port) return Number(parsed.port)
        return parsed.protocol === 'https:' ? 443 : 80
    } catch {
        return 11434
    }
}

async function fetchOllama(baseUrl: string, path: string, init?: RequestInit) {
    const root = normalizeOllamaBaseUrl(baseUrl)
    const display = ollamaDisplayHost(root)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(`${root}${path.startsWith('/') ? path : `/${path}`}`, {
            ...init,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(init?.headers ?? {})
            },
            redirect: 'error'
        })
        return response
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new AppError(`Ollama at ${display} timed out`, 504)
        }
        throw new AppError(`Cannot reach Ollama at ${display}. Check the URL and that the server is running.`, 400)
    } finally {
        clearTimeout(timer)
    }
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModelOption[]> {
    const response = await fetchOllama(baseUrl, '/api/tags', { method: 'GET' })
    const data = (await response.json().catch(() => ({}))) as {
        models?: Array<{ name?: string; model?: string; details?: { family?: string; parameter_size?: string } }>
        error?: string
    }

    if (!response.ok) {
        throw new AppError(data.error || `Ollama model discovery failed (${response.status})`, 400)
    }

    const models = (data.models ?? [])
        .map((row) => {
            const id = String(row.name || row.model || '').trim()
            if (!id) return null
            const bits = [row.details?.family, row.details?.parameter_size].filter(Boolean)
            return {
                id,
                name: id,
                description: bits.length ? bits.join(' · ') : undefined
            } satisfies OllamaModelOption
        })
        .filter(Boolean) as OllamaModelOption[]

    return models.sort((a, b) => a.name.localeCompare(b.name))
}

export async function assertOllamaModelAvailable(baseUrl: string, model: string) {
    const trimmed = model.trim()
    if (!trimmed) throw new AppError('Select an Ollama model', 400)
    if (/[\/\\]|\.\./.test(trimmed) || /^https?:/i.test(trimmed)) {
        throw new AppError('Invalid Ollama model name', 400)
    }
    const models = await listOllamaModels(baseUrl)
    if (!models.some((row) => row.id === trimmed)) {
        throw new AppError(`Model "${trimmed}" is not available on that Ollama server. Pull it first, then refresh.`, 400)
    }
    return trimmed
}

function extractJsonObject(text: string): Record<string, unknown> | null {
    const trimmed = text.trim()
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const candidate = fenced?.[1]?.trim() || trimmed
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    } catch {
        return null
    }
}

function parseToolDirective(text: string): { name: string; args: Record<string, unknown> } | null {
    const parsed = extractJsonObject(text)
    if (!parsed) return null
    const tool = typeof parsed.tool === 'string' ? parsed.tool : typeof parsed.name === 'string' ? parsed.name : null
    if (!tool || (tool !== 'getDatabaseSchema' && tool !== 'runSafeSQL')) return null
    const args =
        parsed.args && typeof parsed.args === 'object' && !Array.isArray(parsed.args)
            ? (parsed.args as Record<string, unknown>)
            : parsed.query
              ? { query: parsed.query }
              : {}
    return { name: tool, args }
}

const TOOL_PROTOCOL = `You can call tools by replying with ONLY one JSON object and nothing else:
{"tool":"getDatabaseSchema","args":{}}
or
{"tool":"runSafeSQL","args":{"query":"SELECT ..."}}

After tools return results, continue until you can answer.
When finished, reply with ONLY the final analytics JSON:
{"explanation":"...","charts":[...],"refusal":"optional"}`

export async function ollamaChat(baseUrl: string, model: string, messages: OllamaChatMessage[]) {
    const response = await fetchOllama(baseUrl, '/api/chat', {
        method: 'POST',
        body: JSON.stringify({
            model,
            messages,
            stream: false,
            options: {
                temperature: 0.2
            }
        })
    })

    const data = (await response.json().catch(() => ({}))) as {
        message?: { role?: string; content?: string }
        error?: string
    }

    if (!response.ok) {
        logger.error('Ollama chat error', {
            meta: { status: response.status, model, baseUrl: ollamaDisplayHost(baseUrl), error: data.error }
        })
        throw new AppError(data.error || `Ollama chat failed (${response.status})`, 502)
    }

    return String(data.message?.content ?? '')
}

export async function runOllamaAnalyticsChat(params: {
    baseUrl: string
    model: string
    systemPrompt: string
    userMessage: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    maxIterations?: number
}) {
    const { baseUrl, model, systemPrompt, userMessage, history = [], maxIterations = 10 } = params
    await assertOllamaModelAvailable(baseUrl, model)

    const messages: OllamaChatMessage[] = [
        { role: 'system', content: `${systemPrompt}\n\n${TOOL_PROTOCOL}` },
        ...history.map((turn) => ({
            role: turn.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: turn.content
        })),
        { role: 'user', content: userMessage }
    ]

    for (let i = 0; i < maxIterations; i++) {
        const content = await ollamaChat(baseUrl, model, messages)
        const toolCall = parseToolDirective(content)
        if (toolCall) {
            logger.info('Ollama tool call', { meta: { tool: toolCall.name, model, baseUrl: ollamaDisplayHost(baseUrl) } })
            let toolResult: string
            try {
                toolResult = await runToolCall(toolCall.name, toolCall.args)
            } catch (error) {
                toolResult = JSON.stringify({
                    error: error instanceof Error ? error.message : String(error)
                })
            }
            messages.push({ role: 'assistant', content })
            messages.push({
                role: 'user',
                content: `Tool ${toolCall.name} result:\n${toolResult}\n\nContinue. Call another tool with tool JSON if needed, otherwise return the final analytics JSON only.`
            })
            continue
        }

        return content
    }

    messages.push({
        role: 'user',
        content: 'Stop calling tools. Return the final analytics JSON only.'
    })
    return ollamaChat(baseUrl, model, messages)
}
