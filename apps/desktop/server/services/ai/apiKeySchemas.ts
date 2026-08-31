import { z } from 'zod'

export const SaveGeminiApiKeySchema = z.object({
    apiKey: z.string().min(10).max(512),
    model: z.string().min(1).max(128).optional()
})

export const SaveGeminiModelSchema = z.object({
    model: z.string().min(1).max(128)
})

export const SaveAiProviderSchema = z.object({
    provider: z.enum(['gemini', 'ollama'])
})

export const SaveOllamaSettingsSchema = z.object({
    baseUrl: z.string().min(1).max(512).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    model: z.string().min(1).max(256).optional(),
    setActive: z.boolean().optional()
})

export type SaveGeminiApiKeyInput = z.infer<typeof SaveGeminiApiKeySchema>
export type SaveGeminiModelInput = z.infer<typeof SaveGeminiModelSchema>
export type SaveAiProviderInput = z.infer<typeof SaveAiProviderSchema>
export type SaveOllamaSettingsInput = z.infer<typeof SaveOllamaSettingsSchema>
