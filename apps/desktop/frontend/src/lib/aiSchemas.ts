import { z } from 'zod'

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

export type ChartSpec = z.infer<typeof ChartSpecSchema>
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>
