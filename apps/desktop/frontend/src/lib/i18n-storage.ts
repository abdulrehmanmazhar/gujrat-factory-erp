export type AppLanguage = 'en' | 'ur'

export const UI_LANG_KEY = 'erp-ui-language'
export const DOC_LANG_KEY = 'erp-document-language'

export function normalizeLanguage(value?: string | null): AppLanguage {
    return value?.toLowerCase() === 'ur' ? 'ur' : 'en'
}

export function getStoredUiLanguage(): AppLanguage {
    return normalizeLanguage(localStorage.getItem(UI_LANG_KEY))
}

export function setStoredUiLanguage(lang: AppLanguage) {
    localStorage.setItem(UI_LANG_KEY, lang)
}

export function getStoredDocumentLanguage(): AppLanguage {
    return normalizeLanguage(localStorage.getItem(DOC_LANG_KEY))
}

export function setStoredDocumentLanguage(lang: AppLanguage) {
    localStorage.setItem(DOC_LANG_KEY, lang)
}
