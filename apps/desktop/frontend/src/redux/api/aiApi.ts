import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { AiChatResponse } from '@/lib/aiSchemas'
import type { ApiEnvelope } from '@/types/api'

export type ChatHistoryTurn = { role: 'user' | 'assistant'; content: string }

export type GeminiKeyStatus = { configured: boolean; model: string }

export type GeminiModelOption = {
    id: string
    name: string
    description?: string
}

export type GeminiModelsResponse = {
    models: GeminiModelOption[]
    source: 'google' | 'fallback'
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
        getGeminiKeyStatus: builder.query<GeminiKeyStatus, void>({
            query: () => '/ai/gemini/status',
            transformResponse: (response: ApiEnvelope<GeminiKeyStatus>) => unwrapData(response),
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
        saveGeminiApiKey: builder.mutation<GeminiKeyStatus, { apiKey: string; model?: string }>({
            query: (body) => ({ url: '/ai/gemini/api-key', method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<GeminiKeyStatus>) => unwrapData(response),
            invalidatesTags: ['AiChat']
        }),
        saveGeminiModel: builder.mutation<GeminiKeyStatus, { model: string }>({
            query: (body) => ({ url: '/ai/gemini/model', method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<GeminiKeyStatus>) => unwrapData(response),
            invalidatesTags: ['AiChat']
        }),
        removeGeminiApiKey: builder.mutation<{ configured: boolean }, void>({
            query: () => ({ url: '/ai/gemini/api-key', method: 'DELETE' }),
            transformResponse: (response: ApiEnvelope<{ configured: boolean }>) => unwrapData(response),
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
