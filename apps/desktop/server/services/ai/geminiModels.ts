export type GeminiModelOption = {
    id: string
    name: string
    description?: string
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/** Curated fallback when the Models API is unavailable. */
export const FALLBACK_GEMINI_MODELS: GeminiModelOption[] = [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Best for agentic analytics and tool use' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Fast and cost-efficient' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Reliable general-purpose model' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Higher quality, slower' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Stable legacy flash model' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Lightweight legacy model' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Older flash model' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Older pro model' }
]

const FALLBACK_IDS = new Set(FALLBACK_GEMINI_MODELS.map((m) => m.id))

export function normalizeGeminiModelId(model: string | null | undefined) {
    const trimmed = model?.trim()
    return trimmed || DEFAULT_GEMINI_MODEL
}

export function isAllowedGeminiModel(model: string) {
    return /^gemini-[a-z0-9.-]+$/i.test(model)
}

function displayNameFromId(id: string) {
    const fallback = FALLBACK_GEMINI_MODELS.find((m) => m.id === id)
    if (fallback) return fallback.name
    return id
        .replace(/^models\//, '')
        .replace(/^gemini-/i, 'Gemini ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function fetchGeminiModels(apiKey: string): Promise<GeminiModelOption[]> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`)
    const data = (await response.json()) as {
        models?: Array<{
            name?: string
            displayName?: string
            description?: string
            supportedGenerationMethods?: string[]
        }>
        error?: { message?: string }
    }

    if (!response.ok) {
        throw new Error(data.error?.message || `Failed to list Gemini models (${response.status})`)
    }

    const models = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => {
            const id = (m.name ?? '').replace(/^models\//, '')
            return {
                id,
                name: m.displayName || displayNameFromId(id),
                description: m.description
            }
        })
        .filter((m) => m.id.startsWith('gemini-'))
        .sort((a, b) => {
            const aKnown = FALLBACK_IDS.has(a.id) ? 0 : 1
            const bKnown = FALLBACK_IDS.has(b.id) ? 0 : 1
            if (aKnown !== bKnown) return aKnown - bKnown
            return a.id.localeCompare(b.id)
        })

    return models.length > 0 ? models : FALLBACK_GEMINI_MODELS
}

export function getFallbackGeminiModels() {
    return FALLBACK_GEMINI_MODELS
}
