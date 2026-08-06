import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { AiChatRequestSchema } from '../services/ai/schemas.js'
import { SaveGeminiApiKeySchema, SaveGeminiModelSchema } from '../services/ai/apiKeySchemas.js'
import { runAiAnalyticsChat } from '../services/ai.service.js'
import { getFallbackGeminiModels } from '../services/ai/geminiModels.js'
import { param } from '../utils/params.js'
import {
    createAiChatSession,
    deleteAiChatSession,
    getAiChatSession,
    listAiChatSessions,
    runPersistedAiChat,
    saveAssistantAiChatMessage,
    saveAssistantErrorMessage
} from '../services/aiChatHistory.service.js'
import {
    getGeminiApiKeyStatus,
    listGeminiModelsForUser,
    removeUserGeminiApiKey,
    saveUserGeminiApiKey,
    saveUserGeminiModel
} from '../services/geminiApiKey.service.js'

export const getGeminiKeyStatus = CatchAsyncError(async (req: Request, res: Response) => {
    const status = await getGeminiApiKeyStatus(req.user!.id)
    httpResponse(req, res, 200, 'Gemini API key status', status)
})

export const listGeminiModels = CatchAsyncError(async (req: Request, res: Response) => {
    const result = await listGeminiModelsForUser(req.user!.id)
    httpResponse(req, res, 200, 'Gemini models listed', result)
})

export const listGeminiModelsPublic = CatchAsyncError(async (req: Request, res: Response) => {
    httpResponse(req, res, 200, 'Gemini models listed', {
        models: getFallbackGeminiModels(),
        source: 'fallback'
    })
})

export const saveGeminiKey = CatchAsyncError(async (req: Request, res: Response) => {
    const parsed = SaveGeminiApiKeySchema.safeParse(req.body)
    if (!parsed.success) {
        throw new AppError(parsed.error.issues.map((e) => e.message).join('; '), 400)
    }

    await saveUserGeminiApiKey(req.user!.id, parsed.data.apiKey, parsed.data.model)
    const status = await getGeminiApiKeyStatus(req.user!.id)
    httpResponse(req, res, 200, 'Gemini API key saved', status)
})

export const saveGeminiModel = CatchAsyncError(async (req: Request, res: Response) => {
    const parsed = SaveGeminiModelSchema.safeParse(req.body)
    if (!parsed.success) {
        throw new AppError(parsed.error.issues.map((e) => e.message).join('; '), 400)
    }

    await saveUserGeminiModel(req.user!.id, parsed.data.model)
    const status = await getGeminiApiKeyStatus(req.user!.id)
    httpResponse(req, res, 200, 'Gemini model updated', status)
})

export const removeGeminiKey = CatchAsyncError(async (req: Request, res: Response) => {
    await removeUserGeminiApiKey(req.user!.id)
    httpResponse(req, res, 200, 'Gemini API key removed', { configured: false })
})

export const getAiSessions = CatchAsyncError(async (req: Request, res: Response) => {
    const sessions = await listAiChatSessions(req.user!.id)
    httpResponse(req, res, 200, 'AI chat sessions fetched', { sessions })
})

export const postAiSession = CatchAsyncError(async (req: Request, res: Response) => {
    const session = await createAiChatSession(req.user!.id)
    httpResponse(req, res, 201, 'AI chat session created', { session })
})

export const getAiSession = CatchAsyncError(async (req: Request, res: Response) => {
    const session = await getAiChatSession(req.user!.id, param(req.params.id))
    httpResponse(req, res, 200, 'AI chat session fetched', { session })
})

export const deleteAiSession = CatchAsyncError(async (req: Request, res: Response) => {
    await deleteAiChatSession(req.user!.id, param(req.params.id))
    httpResponse(req, res, 200, 'AI chat session deleted', { deleted: true })
})

export const postAiChat = CatchAsyncError(async (req: Request, res: Response) => {
    const parsed = AiChatRequestSchema.safeParse(req.body)
    if (!parsed.success) {
        throw new AppError(parsed.error.issues.map((e) => e.message).join('; '), 400)
    }

    const { sessionId, userMessage, history } = await runPersistedAiChat(req.user!.id, parsed.data.sessionId, parsed.data.message)

    try {
        const response = await runAiAnalyticsChat(req.user!.id, {
            message: parsed.data.message,
            history
        })

        const assistantText = response.refusal ? `${response.explanation}\n\n${response.refusal}` : response.explanation

        const assistantMessage = await saveAssistantAiChatMessage(sessionId, assistantText, response)

        httpResponse(req, res, 200, 'AI response generated', {
            sessionId,
            userMessage,
            assistantMessage,
            response
        })
    } catch (error) {
        const fallbackText =
            error instanceof AppError ? error.message : 'Sorry, I could not process that request. Please try again or switch to another Gemini model.'

        const assistantMessage = await saveAssistantErrorMessage(sessionId, fallbackText)

        httpResponse(req, res, 200, 'AI response generated with errors', {
            sessionId,
            userMessage,
            assistantMessage,
            response: null,
            error: fallbackText
        })
    }
})
