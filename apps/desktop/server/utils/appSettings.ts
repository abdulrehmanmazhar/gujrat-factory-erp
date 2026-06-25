import fs from 'node:fs'
import path from 'node:path'
import type { Request } from 'express'
import { getDataDir } from './rcloneSetup.js'
import { type DocumentLanguage, normalizeDocumentLanguage } from './documentI18n.js'

export type AppSettings = {
    documentLanguage: DocumentLanguage
}

const DEFAULT_SETTINGS: AppSettings = {
    documentLanguage: 'en'
}

function settingsPath() {
    return path.join(getDataDir(), 'app-settings.json')
}

export function readAppSettings(): AppSettings {
    const file = settingsPath()
    if (!fs.existsSync(file)) return { ...DEFAULT_SETTINGS }

    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AppSettings>
        return {
            documentLanguage: normalizeDocumentLanguage(parsed.documentLanguage)
        }
    } catch {
        return { ...DEFAULT_SETTINGS }
    }
}

export function writeAppSettings(settings: AppSettings) {
    const file = settingsPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
        file,
        JSON.stringify(
            {
                documentLanguage: normalizeDocumentLanguage(settings.documentLanguage)
            },
            null,
            2
        ),
        'utf8'
    )
}

export function getDocumentLanguage(req?: Request) {
    const header = req?.headers['x-document-language']
    if (typeof header === 'string' && header.trim()) {
        return normalizeDocumentLanguage(header)
    }
    return readAppSettings().documentLanguage
}
