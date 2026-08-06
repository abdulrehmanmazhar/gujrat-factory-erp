import crypto from 'node:crypto'
import { appConfig } from '../config/env.js'
import { getClient } from '../utils/db.js'
import { createId } from '../utils/mappers.js'
import { AppError } from '../utils/errors.js'
import { DEFAULT_GEMINI_MODEL, fetchGeminiModels, getFallbackGeminiModels, isAllowedGeminiModel, normalizeGeminiModelId } from './ai/geminiModels.js'

type ApiKeyRow = {
    id: string
    user_id: string
    api_key: string
    model?: string | null
}

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12

function encryptionSecret() {
    const secret = appConfig.ACTIVATION_SECRET || 'local-gemini-key-fallback'
    return crypto.createHash('sha256').update(secret).digest()
}

function encryptApiKey(plain: string) {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGO, encryptionSecret(), iv)
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

function decryptApiKey(stored: string) {
    const [ivB64, tagB64, dataB64] = stored.split('.')
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new AppError('Stored Gemini API key is invalid — please save it again', 500)
    }

    const iv = Buffer.from(ivB64, 'base64url')
    const tag = Buffer.from(tagB64, 'base64url')
    const data = Buffer.from(dataB64, 'base64url')
    const decipher = crypto.createDecipheriv(ALGO, encryptionSecret(), iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return decrypted.toString('utf8')
}

async function findApiKeyRow(userId: string): Promise<ApiKeyRow | null> {
    const client = getClient()
    const result = await client.execute({
        sql: 'SELECT id, user_id, api_key, model FROM user_gemini_api_keys WHERE user_id = ? LIMIT 1',
        args: [userId]
    })
    const row = result.rows[0] as unknown as ApiKeyRow | undefined
    return row ?? null
}

async function validateGeminiApiKey(apiKey: string, model: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Reply with OK only.' }] }],
            generationConfig: { maxOutputTokens: 8 }
        })
    })

    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
        throw new AppError(data.error?.message || 'Invalid Gemini API key or model', 400)
    }
}

export async function saveUserGeminiApiKey(userId: string, apiKey: string, model?: string) {
    const trimmed = apiKey.trim()
    if (!trimmed) throw new AppError('Gemini API key is required', 400)

    const selectedModel = normalizeGeminiModelId(model)
    if (!isAllowedGeminiModel(selectedModel)) {
        throw new AppError('Invalid Gemini model id', 400)
    }

    await validateGeminiApiKey(trimmed, selectedModel)

    const client = getClient()
    const existing = await findApiKeyRow(userId)
    const now = Date.now()
    const encrypted = encryptApiKey(trimmed)

    if (existing) {
        await client.execute({
            sql: 'UPDATE user_gemini_api_keys SET api_key = ?, model = ?, updated_at = ? WHERE user_id = ?',
            args: [encrypted, selectedModel, now, userId]
        })
        return
    }

    await client.execute({
        sql: 'INSERT INTO user_gemini_api_keys (id, user_id, api_key, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [createId(), userId, encrypted, selectedModel, now, now]
    })
}

export async function saveUserGeminiModel(userId: string, model: string) {
    const selectedModel = normalizeGeminiModelId(model)
    if (!isAllowedGeminiModel(selectedModel)) {
        throw new AppError('Invalid Gemini model id', 400)
    }

    const row = await findApiKeyRow(userId)
    if (!row) throw new AppError('Add your Gemini API key first', 401)

    const apiKey = decryptApiKey(row.api_key)
    await validateGeminiApiKey(apiKey, selectedModel)

    await getClient().execute({
        sql: 'UPDATE user_gemini_api_keys SET model = ?, updated_at = ? WHERE user_id = ?',
        args: [selectedModel, Date.now(), userId]
    })
}

export async function getUserGeminiApiKey(userId: string): Promise<string> {
    const row = await findApiKeyRow(userId)
    if (!row) {
        throw new AppError('Add your Gemini API key to use AI analytics', 401)
    }
    return decryptApiKey(row.api_key)
}

export async function getUserGeminiModel(userId: string): Promise<string> {
    const row = await findApiKeyRow(userId)
    return normalizeGeminiModelId(row?.model ?? DEFAULT_GEMINI_MODEL)
}

export async function getGeminiApiKeyStatus(userId: string) {
    const row = await findApiKeyRow(userId)
    return {
        configured: Boolean(row),
        model: normalizeGeminiModelId(row?.model ?? DEFAULT_GEMINI_MODEL)
    }
}

export async function listGeminiModelsForUser(userId: string) {
    const row = await findApiKeyRow(userId)
    if (!row) {
        return { models: getFallbackGeminiModels(), source: 'fallback' as const }
    }

    try {
        const apiKey = decryptApiKey(row.api_key)
        const models = await fetchGeminiModels(apiKey)
        return { models, source: 'google' as const }
    } catch {
        return { models: getFallbackGeminiModels(), source: 'fallback' as const }
    }
}

export async function removeUserGeminiApiKey(userId: string) {
    const client = getClient()
    await client.execute({ sql: 'DELETE FROM user_gemini_api_keys WHERE user_id = ?', args: [userId] })
}
