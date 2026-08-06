import { z } from 'zod'

export function parseAiChatResponse(raw: string) {
    const trimmed = raw.trim()
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const candidate = fenced?.[1]?.trim() ?? trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
    const parsed = JSON.parse(candidate)
    return AiChatResponseSchema.parse(parsed)
}

export const ChartTypeSchema = z.enum(['line', 'bar', 'pie', 'area'])

export const ChartSpecSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: ChartTypeSchema,
    xKey: z.string().min(1),
    yKeys: z.array(z.string().min(1)).min(1),
    data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
})

export const AiChatResponseSchema = z.object({
    explanation: z.string(),
    charts: z.array(ChartSpecSchema).default([]),
    refusal: z.string().optional()
})

export const AiChatRequestSchema = z.object({
    message: z.string().min(1).max(4000),
    sessionId: z.string().uuid().optional(),
    history: z
        .array(
            z.object({
                role: z.enum(['user', 'assistant']),
                content: z.string()
            })
        )
        .max(20)
        .optional()
})

export type ChartSpec = z.infer<typeof ChartSpecSchema>
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>
