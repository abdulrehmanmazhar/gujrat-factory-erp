import fs from 'node:fs'
import path from 'node:path'
import type { Request } from 'express'
import { getDataDir } from './rcloneSetup.js'
import { type DocumentLanguage, normalizeDocumentLanguage } from './documentI18n.js'

export const DEFAULT_POS_BANNER_HEIGHT = 200
export const MIN_POS_BANNER_HEIGHT = 60
export const MAX_POS_BANNER_HEIGHT = 400

export type AppSettings = {
    documentLanguage: DocumentLanguage
    posBannerUrl: string | null
    posBannerPublicId: string | null
    posBannerHeightPx: number
}

const DEFAULT_SETTINGS: AppSettings = {
    documentLanguage: 'en',
    posBannerUrl: null,
    posBannerPublicId: null,
    posBannerHeightPx: DEFAULT_POS_BANNER_HEIGHT
}

function settingsPath() {
    return path.join(getDataDir(), 'app-settings.json')
}

export function normalizePosBannerHeight(value?: number | null) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return DEFAULT_POS_BANNER_HEIGHT
    return Math.min(MAX_POS_BANNER_HEIGHT, Math.max(MIN_POS_BANNER_HEIGHT, Math.round(parsed)))
}

function normalizeSettings(parsed: Partial<AppSettings> | null | undefined): AppSettings {
    return {
        documentLanguage: normalizeDocumentLanguage(parsed?.documentLanguage),
        posBannerUrl: parsed?.posBannerUrl ? String(parsed.posBannerUrl) : null,
        posBannerPublicId: parsed?.posBannerPublicId ? String(parsed.posBannerPublicId) : null,
        posBannerHeightPx: normalizePosBannerHeight(parsed?.posBannerHeightPx)
    }
}

export function readAppSettings(): AppSettings {
    const file = settingsPath()
    if (!fs.existsSync(file)) return { ...DEFAULT_SETTINGS }

    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AppSettings>
        return normalizeSettings(parsed)
    } catch {
        return { ...DEFAULT_SETTINGS }
    }
}

export function writeAppSettings(settings: AppSettings) {
    const file = settingsPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(normalizeSettings(settings), null, 2), 'utf8')
}

export function getDocumentLanguage(req?: Request) {
    const header = req?.headers['x-document-language']
    if (typeof header === 'string' && header.trim()) {
        return normalizeDocumentLanguage(header)
    }
    return readAppSettings().documentLanguage
}
