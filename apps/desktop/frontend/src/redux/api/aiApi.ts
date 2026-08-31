import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { AiChatResponse } from '@/lib/aiSchemas'
import type { ApiEnvelope } from '@/types/api'

export type ChatHistoryTurn = { role: 'user' | 'assistant'; content: string }

export type AiProvider = 'gemini' | 'ollama'

export type GeminiModelOption = {
    id: string
    name: string
    description?: string
}

export type GeminiModelsResponse = {
    models: GeminiModelOption[]
    source: 'google' | 'fallback'
}

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
        models?: GeminiModelOption[]
        error?: string
    }
}

export type OllamaModelsResponse = {
    baseUrl: string
    displayUrl: string
    port: number
    models: GeminiModelOption[]
    selectedModel: string | null
}

export type AiChatMessageRecord = {
    id: string
    role: 'user' | 'assistant'
    content: string
    response: AiChatResponse | null
    createdAt: string
}

export type AiChatSessionSummary = {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messageCount: number
    preview: string | null
}

export type AiChatSessionDetail = {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messages: AiChatMessageRecord[]
}

export type AiChatSendResult = {
    sessionId: string
    userMessage: AiChatMessageRecord
    assistantMessage: AiChatMessageRecord
    response: AiChatResponse | null
    error?: string
}

export const aiApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAiProviderStatus: builder.query<AiProviderStatus, { probeOllama?: boolean } | void>({
            query: (args) => ({
                url: '/ai/provider',
                params: args?.probeOllama ? { probeOllama: 'true' } : undefined
            }),
            transformResponse: (response: ApiEnvelope<AiProviderStatus>) => unwrapData(response),
            providesTags: ['AiChat']
        }),
        setAiProvider: builder.mutation<AiProviderStatus, { provider: AiProvider }>({
            query: (body) => ({ url: '/ai/provider', method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<AiProviderStatus>) => unwrapData(response),
            invalidatesTags: ['AiChat']
        }),
        getOllamaModels: builder.query<OllamaModelsResponse, string | void>({
            query: (baseUrl) => ({
                url: '/ai/ollama/models',
                params: baseUrl ? { baseUrl } : undefined
            }),
            transformResponse: (response: ApiEnvelope<OllamaModelsResponse>) => unwrapData(response),
            providesTags: ['AiChat']
        }),
        saveOllamaSettings: builder.mutation<AiProviderStatus, { baseUrl?: string; port?: number; model?: string; setActive?: boolean }>({
            query: (body) => ({ url: '/ai/ollama', method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<AiProviderStatus>) => unwrapData(response),
            invalidatesTags: ['AiChat']
        }),
        getGeminiKeyStatus: builder.query<{ configured: boolean; model: string }, void>({
            query: () => '/ai/gemini/status',
            transformResponse: (response: ApiEnvelope<{ configured: boolean; model: string }>) => unwrapData(response),
            providesTags: ['AiChat']
        }),
        getGeminiModels: builder.query<GeminiModelsResponse, void>({
            query: () => '/ai/gemini/models',
            transformResponse: (response: ApiEnvelope<GeminiModelsResponse>) => unwrapData(response),
            providesTags: ['AiChat']
        }),
        getGeminiModelsPublic: builder.query<GeminiModelsResponse, void>({
            query: () => '/ai/gemini/models/public',
            transformResponse: (response: ApiEnvelope<GeminiModelsResponse>) => unwrapData(response)
        }),
        saveGeminiApiKey: builder.mutation<AiProviderStatus, { apiKey: string; model?: string }>({
            query: (body) => ({ url: '/ai/gemini/api-key', method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<AiProviderStatus>) => unwrapData(response),
            invalidatesTags: ['AiChat']
        }),
        saveGeminiModel: builder.mutation<AiProviderStatus, { model: string }>({
            query: (body) => ({ url: '/ai/gemini/model', method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<AiProviderStatus>) => unwrapData(response),
            invalidatesTags: ['AiChat']
        }),
        removeGeminiApiKey: builder.mutation<AiProviderStatus, void>({
            query: () => ({ url: '/ai/gemini/api-key', method: 'DELETE' }),
            transformResponse: (response: ApiEnvelope<AiProviderStatus>) => unwrapData(response),
            invalidatesTags: ['AiChat']
        }),
        getAiSessions: builder.query<{ sessions: AiChatSessionSummary[] }, void>({
            query: () => '/ai/sessions',
            transformResponse: (response: ApiEnvelope<{ sessions: AiChatSessionSummary[] }>) => unwrapData(response),
            providesTags: ['AiChatSessions']
        }),
        createAiSession: builder.mutation<{ session: AiChatSessionSummary }, void>({
            query: () => ({ url: '/ai/sessions', method: 'POST' }),
            transformResponse: (response: ApiEnvelope<{ session: AiChatSessionSummary }>) => unwrapData(response),
            invalidatesTags: ['AiChatSessions']
        }),
        getAiSession: builder.query<{ session: AiChatSessionDetail }, string>({
            query: (sessionId) => `/ai/sessions/${sessionId}`,
            transformResponse: (response: ApiEnvelope<{ session: AiChatSessionDetail }>) => unwrapData(response),
            providesTags: (_result, _error, sessionId) => [{ type: 'AiChatSession', id: sessionId }]
        }),
        deleteAiSession: builder.mutation<{ deleted: boolean }, string>({
            query: (sessionId) => ({ url: `/ai/sessions/${sessionId}`, method: 'DELETE' }),
            transformResponse: (response: ApiEnvelope<{ deleted: boolean }>) => unwrapData(response),
            invalidatesTags: ['AiChatSessions']
        }),
        sendAiChat: builder.mutation<AiChatSendResult, { message: string; sessionId?: string }>({
            query: (body) => ({ url: '/ai/chat', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<AiChatSendResult>) => unwrapData(response),
            invalidatesTags: (result) => ['AiChatSessions', ...(result?.sessionId ? [{ type: 'AiChatSession' as const, id: result.sessionId }] : [])]
        })
    })
})

export const {
    useGetAiProviderStatusQuery,
    useSetAiProviderMutation,
    useGetOllamaModelsQuery,
    useSaveOllamaSettingsMutation,
    useGetGeminiKeyStatusQuery,
    useGetGeminiModelsQuery,
    useGetGeminiModelsPublicQuery,
    useSaveGeminiApiKeyMutation,
    useSaveGeminiModelMutation,
    useRemoveGeminiApiKeyMutation,
    useGetAiSessionsQuery,
    useCreateAiSessionMutation,
    useGetAiSessionQuery,
    useDeleteAiSessionMutation,
    useSendAiChatMutation
} = aiApi
