import { z } from 'zod'

export const SaveGeminiApiKeySchema = z.object({
    apiKey: z.string().min(10).max(512),
    model: z.string().min(1).max(128).optional()
})

export const SaveGeminiModelSchema = z.object({
    model: z.string().min(1).max(128)
})

export type SaveGeminiApiKeyInput = z.infer<typeof SaveGeminiApiKeySchema>
export type SaveGeminiModelInput = z.infer<typeof SaveGeminiModelSchema>
