import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { userAiProviderSettings } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId } from '../utils/mappers.js'
import { getGeminiApiKeyStatus } from './geminiApiKey.service.js'
import {
    assertOllamaModelAvailable,
    DEFAULT_OLLAMA_BASE_URL,
    extractOllamaPort,
    listOllamaModels,
    normalizeOllamaBaseUrl,
    ollamaDisplayHost,
    type OllamaModelOption
} from './ai/ollamaClient.js'

export type AiProvider = 'gemini' | 'ollama'

export type AiProviderStatus = {
    provider: AiProvider
    gemini: { configured: boolean; model: string }
    ollama: {
        configured: boolean
        baseUrl: string
        displayUrl: string
        port: number
        model: string | null
        reachable?: boolean
        models?: OllamaModelOption[]
        error?: string
    }
}

function resolveSettingsBaseUrl(settings: { ollamaBaseUrl?: string | null; ollamaPort?: number | null }) {
    if (settings.ollamaBaseUrl && String(settings.ollamaBaseUrl).trim()) {
        return normalizeOllamaBaseUrl(settings.ollamaBaseUrl)
    }
    if (settings.ollamaPort) {
        return normalizeOllamaBaseUrl(settings.ollamaPort)
    }
    return DEFAULT_OLLAMA_BASE_URL
}

async function getOrCreateSettings(userId: string) {
    const [existing] = await db.select().from(userAiProviderSettings).where(eq(userAiProviderSettings.userId, userId)).limit(1)
    if (existing) return existing

    const [created] = await db
        .insert(userAiProviderSettings)
        .values({
            id: createId(),
            userId
        })
        .returning()
    return created
}

export async function getAiProviderStatus(userId: string, options?: { probeOllama?: boolean }): Promise<AiProviderStatus> {
    const settings = await getOrCreateSettings(userId)
    const gemini = await getGeminiApiKeyStatus(userId)
    const baseUrl = resolveSettingsBaseUrl(settings)
    const ollamaBase = {
        configured: Boolean(settings.ollamaModel),
        baseUrl,
        displayUrl: ollamaDisplayHost(baseUrl),
        port: extractOllamaPort(baseUrl),
        model: settings.ollamaModel ?? null
    }

    if (!options?.probeOllama && settings.provider !== 'ollama') {
        return {
            provider: (settings.provider as AiProvider) || 'gemini',
            gemini,
            ollama: ollamaBase
        }
    }

    try {
        const models = await listOllamaModels(baseUrl)
        return {
            provider: (settings.provider as AiProvider) || 'gemini',
            gemini,
            ollama: {
                ...ollamaBase,
                reachable: true,
                models,
                configured: Boolean(settings.ollamaModel && models.some((m) => m.id === settings.ollamaModel))
            }
        }
    } catch (error) {
        return {
            provider: (settings.provider as AiProvider) || 'gemini',
            gemini,
            ollama: {
                ...ollamaBase,
                reachable: false,
                models: [],
                error: error instanceof Error ? error.message : 'Ollama unavailable'
            }
        }
    }
}

export async function setAiProvider(userId: string, provider: AiProvider) {
    if (provider !== 'gemini' && provider !== 'ollama') {
        throw new AppError('Provider must be gemini or ollama', 400)
    }
    await getOrCreateSettings(userId)

    await db
        .update(userAiProviderSettings)
        .set({ provider, updatedAt: new Date() } as Record<string, unknown>)
        .where(eq(userAiProviderSettings.userId, userId))

    return getAiProviderStatus(userId, { probeOllama: provider === 'ollama' })
}

export async function saveOllamaSettings(
    userId: string,
    input: { baseUrl?: string; port?: number; model?: string; setActive?: boolean }
) {
    const settings = await getOrCreateSettings(userId)
    const baseUrl = normalizeOllamaBaseUrl(
        input.baseUrl ?? (input.port != null ? input.port : null) ?? settings.ollamaBaseUrl ?? settings.ollamaPort
    )
    let model = settings.ollamaModel

    if (input.model !== undefined) {
        model = await assertOllamaModelAvailable(baseUrl, input.model)
    } else {
        await listOllamaModels(baseUrl)
        if (model) {
            model = await assertOllamaModelAvailable(baseUrl, model)
        }
    }

    await db
        .update(userAiProviderSettings)
        .set({
            ollamaBaseUrl: baseUrl,
            ollamaPort: extractOllamaPort(baseUrl),
            ollamaModel: model,
            provider: input.setActive === false ? settings.provider : 'ollama',
            updatedAt: new Date()
        } as Record<string, unknown>)
        .where(eq(userAiProviderSettings.userId, userId))

    return getAiProviderStatus(userId, { probeOllama: true })
}

export async function listUserOllamaModels(userId: string, baseUrlOverride?: string | number) {
    const settings = await getOrCreateSettings(userId)
    const baseUrl = normalizeOllamaBaseUrl(
        baseUrlOverride ?? settings.ollamaBaseUrl ?? settings.ollamaPort ?? DEFAULT_OLLAMA_BASE_URL
    )
    const models = await listOllamaModels(baseUrl)
    return {
        baseUrl,
        displayUrl: ollamaDisplayHost(baseUrl),
        port: extractOllamaPort(baseUrl),
        models,
        selectedModel: settings.ollamaModel
    }
}

export async function getActiveAiRuntime(userId: string) {
    const settings = await getOrCreateSettings(userId)
    const provider = (settings.provider as AiProvider) || 'gemini'
    if (provider === 'ollama') {
        if (!settings.ollamaModel) {
            throw new AppError('Select an Ollama model before chatting', 401)
        }
        const baseUrl = resolveSettingsBaseUrl(settings)
        return {
            provider: 'ollama' as const,
            baseUrl,
            port: extractOllamaPort(baseUrl),
            model: settings.ollamaModel
        }
    }
    return { provider: 'gemini' as const }
}
