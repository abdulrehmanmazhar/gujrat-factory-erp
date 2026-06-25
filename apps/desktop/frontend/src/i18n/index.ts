import { en, type TranslationTree } from './en'
import { ur } from './ur'
import type { AppLanguage } from '@/lib/i18n-storage'

const catalogs: Record<AppLanguage, TranslationTree> = { en, ur }

export function getTranslations(lang: AppLanguage): TranslationTree {
    return catalogs[lang] ?? en
}

export function interpolate(template: string, values: Record<string, string>) {
    return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template)
}

export type { TranslationTree }
