import { logger } from '../../config/logger.js'

export type GeminiPart = Record<string, unknown>

export type GeminiContent = {
    role: 'user' | 'model'
    parts: GeminiPart[]
}

type FunctionDeclaration = {
    name: string
    description: string
    parameters: {
        type: string
        properties: Record<string, unknown>
        required?: string[]
    }
}

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
    {
        name: 'getDatabaseSchema',
        description: 'Returns the SQLite ERP database schema and business context.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'runSafeSQL',
        description: 'Executes a read-only SELECT query against the local ERP SQLite database.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'SQLite SELECT statement' }
            },
            required: ['query']
        }
    }
]

const RESPONSE_JSON_SCHEMA = {
    type: 'object',
    properties: {
        explanation: { type: 'string' },
        charts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    type: { type: 'string', enum: ['line', 'bar', 'pie', 'area'] },
                    xKey: { type: 'string' },
                    yKeys: { type: 'array', items: { type: 'string' } },
                    data: {
                        type: 'array',
                        items: { type: 'object', additionalProperties: true }
                    }
                },
                required: ['id', 'title', 'type', 'xKey', 'yKeys', 'data']
            }
        },
        refusal: { type: 'string' }
    },
    required: ['explanation', 'charts']
}

function geminiUrl(model: string) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

export type GeminiGenerateResult = {
    parts: GeminiPart[]
    modelTurn: GeminiContent
}

type GenerateOptions = {
    systemInstruction?: string
    toolsEnabled?: boolean
    jsonMode?: boolean
}

export async function geminiGenerate(
    apiKey: string,
    model: string,
    contents: GeminiContent[],
    options: GenerateOptions = {}
): Promise<GeminiGenerateResult> {
    const { systemInstruction, toolsEnabled = true, jsonMode = false } = options

    const body: Record<string, unknown> = {
        contents,
        generationConfig: {
            maxOutputTokens: 8192
        }
    }

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] }
    }

    if (toolsEnabled) {
        body.tools = [{ functionDeclarations: FUNCTION_DECLARATIONS }]
    }

    if (jsonMode) {
        body.generationConfig = {
            ...(body.generationConfig as Record<string, unknown>),
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_JSON_SCHEMA
        }
    }

    const response = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })

    const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: GeminiPart[]; role?: string } }>
        error?: { message?: string }
    }

    if (!response.ok) {
        logger.error('Gemini API error', { meta: { status: response.status, model, error: data.error } })
        throw new Error(data.error?.message || `Gemini API failed (${response.status})`)
    }

    const parts = data.candidates?.[0]?.content?.parts ?? []
    return {
        parts,
        modelTurn: { role: 'model', parts }
    }
}

export function getFunctionCallPart(parts: GeminiPart[]) {
    return parts.find((part) => part.functionCall && typeof part.functionCall === 'object') ?? null
}

export function extractText(parts: GeminiPart[]) {
    return parts
        .map((part) => (typeof part.text === 'string' ? part.text : undefined))
        .filter(Boolean)
        .join('\n')
}

export async function runToolCall(name: string, args: Record<string, unknown>): Promise<string> {
    const { toolGetDatabaseSchema, toolRunSafeSQL } = await import('./tools.js')
    if (name === 'getDatabaseSchema') {
        return toolGetDatabaseSchema()
    }
    if (name === 'runSafeSQL') {
        return toolRunSafeSQL(String(args.query ?? ''))
    }
    throw new Error(`Unknown tool: ${name}`)
}
