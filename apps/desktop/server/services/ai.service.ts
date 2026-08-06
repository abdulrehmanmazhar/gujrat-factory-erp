import { logger } from '../config/logger.js'
import { AppError } from '../utils/errors.js'
import { getUserGeminiApiKey, getUserGeminiModel } from './geminiApiKey.service.js'
import { extractText, geminiGenerate, getFunctionCallPart, runToolCall, type GeminiContent } from './ai/geminiClient.js'
import { parseAiChatResponse, type AiChatRequest, type AiChatResponse } from './ai/schemas.js'

const SYSTEM_PROMPT = `You are the Gujrat Factory ERP business analytics assistant.

SCOPE — you ONLY help with ERP business analytics:
- Sales, orders, revenue, payments, refunds, udhar/credit
- Inventory, stock, products, categories, units
- Customers, suppliers, restock, labour, production costs
- Miscellaneous factory expenditures
- Trends, comparisons, summaries, KPIs for the factory business

If the user asks anything outside this scope (general knowledge, coding, jokes, personal advice, unrelated topics):
Respond with JSON only: { "explanation": "polite excuse", "charts": [], "refusal": "reason" }

WORKFLOW:
1. Call getDatabaseSchema when you need how the app works, table relationships, money definitions, or exact column names. The tool returns a detailed ERP walkthrough PLUS live SQLite DDL.
2. Call runSafeSQL with SQLite SELECT queries to fetch data. Use datetime(col/1000,'unixepoch') for timestamps stored as Unix ms.
3. After you have enough data, produce the final answer as JSON ONLY (no markdown fences).

FINAL JSON SCHEMA (strict):
{
  "explanation": "Clear business explanation in plain language",
  "charts": [
    {
      "id": "unique-snake-case-id",
      "title": "Chart title",
      "type": "line" | "bar" | "pie" | "area",
      "xKey": "field name for categories/x-axis",
      "yKeys": ["numeric field names"],
      "data": [ { "...": "row objects from query results" } ]
    }
  ],
  "refusal": "optional — only when off-topic"
}

Chart rules:
- Include as many charts as needed to answer the question well (0 or more).
- data rows must match xKey and yKeys fields.
- For pie charts, xKey is the slice label field and yKeys should have one numeric field.
- Use PKR for money in explanation text.
- If a query returns no rows, explain that clearly and return charts: [].

Money guidance (also in schema walkthrough):
- Customer cash in: customer_transactions type='sale'
- Customer refunds: customer_transactions type='refund'
- Supplier payments/refunds: supplier_transactions type payment|refund
- Overhead: miscellaneous_expenditures
- Labour: labourer_transactions / labour_production_entries
- Prefer ledger tables for cashflow over time; orders/order_items for product mix.

Never fabricate numbers — always query first.`

const MAX_TOOL_ITERATIONS = 10

function buildContents(request: AiChatRequest): GeminiContent[] {
    const contents: GeminiContent[] = []

    for (const turn of request.history ?? []) {
        contents.push({
            role: turn.role === 'user' ? 'user' : 'model',
            parts: [{ text: turn.content }]
        })
    }

    contents.push({ role: 'user', parts: [{ text: request.message }] })
    return contents
}

function asFunctionCall(value: unknown): { name: string; args?: Record<string, unknown>; id?: string } | null {
    if (!value || typeof value !== 'object') return null
    const call = value as { name?: string; args?: Record<string, unknown>; id?: string }
    if (!call.name) return null
    return { name: call.name, args: call.args ?? {}, id: call.id }
}

async function finalizeResponse(apiKey: string, model: string, contents: GeminiContent[]): Promise<AiChatResponse> {
    contents.push({
        role: 'user',
        parts: [
            {
                text: 'Using the data you already fetched, respond now with JSON only matching the schema. Do not call any more tools.'
            }
        ]
    })

    const { parts } = await geminiGenerate(apiKey, model, contents, {
        systemInstruction: SYSTEM_PROMPT,
        toolsEnabled: false,
        jsonMode: true
    })

    const text = extractText(parts)
    if (!text.trim()) {
        throw new AppError('AI returned an empty response', 502)
    }

    return parseAiChatResponse(text)
}

export async function runAiAnalyticsChat(userId: string, request: AiChatRequest): Promise<AiChatResponse> {
    try {
        const apiKey = await getUserGeminiApiKey(userId)
        const model = await getUserGeminiModel(userId)
        const contents = buildContents(request)

        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            const { parts, modelTurn } = await geminiGenerate(apiKey, model, contents, {
                systemInstruction: SYSTEM_PROMPT,
                toolsEnabled: true
            })

            const functionCallPart = getFunctionCallPart(parts)
            const functionCall = asFunctionCall(functionCallPart?.functionCall)

            if (functionCall) {
                logger.info('AI tool call', { meta: { tool: functionCall.name, userId, model } })

                let toolResult: string
                try {
                    toolResult = await runToolCall(functionCall.name, functionCall.args ?? {})
                } catch (error) {
                    toolResult = JSON.stringify({
                        error: error instanceof Error ? error.message : String(error)
                    })
                }

                let responsePayload: Record<string, unknown>
                try {
                    responsePayload = JSON.parse(toolResult) as Record<string, unknown>
                } catch {
                    responsePayload = { output: toolResult }
                }

                contents.push(modelTurn)
                contents.push({
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                name: functionCall.name,
                                id: functionCall.id,
                                response: responsePayload
                            }
                        }
                    ]
                })
                continue
            }

            const text = extractText(parts)
            if (!text.trim()) {
                return finalizeResponse(apiKey, model, contents)
            }

            try {
                return parseAiChatResponse(text)
            } catch (error) {
                logger.error('AI response JSON parse failed, retrying with JSON mode', {
                    meta: { error, raw: text.slice(0, 500) }
                })
                return finalizeResponse(apiKey, model, contents)
            }
        }

        return finalizeResponse(apiKey, model, contents)
    } catch (error) {
        if (error instanceof AppError) throw error
        throw new AppError(error instanceof Error ? error.message : 'AI request failed', 502)
    }
}
