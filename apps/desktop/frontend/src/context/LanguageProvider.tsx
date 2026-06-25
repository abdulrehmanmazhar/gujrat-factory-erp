import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { getStoredDocumentLanguage, getStoredUiLanguage, setStoredDocumentLanguage, setStoredUiLanguage, type AppLanguage } from '@/lib/i18n-storage'
import { getTranslations, interpolate, type TranslationTree } from '@/i18n'
import { useGetSettingsQuery, useUpdateSettingsMutation } from '@/redux/api/settingsApi'
import { selectIsLoggedIn } from '@/redux/slices/authSlice'

type LanguageProviderState = {
    uiLanguage: AppLanguage
    documentLanguage: AppLanguage
    dir: 'ltr' | 'rtl'
    t: TranslationTree
    setUiLanguage: (lang: AppLanguage) => void
    setDocumentLanguage: (lang: AppLanguage) => Promise<void>
    format: (template: string, values: Record<string, string>) => string
    settingsLoading: boolean
}

const initialState: LanguageProviderState = {
    uiLanguage: 'en',
    documentLanguage: 'en',
    dir: 'ltr',
    t: getTranslations('en'),
    setUiLanguage: () => undefined,
    setDocumentLanguage: async () => undefined,
    format: (template, values) => interpolate(template, values),
    settingsLoading: true
}

export const LanguageProviderContext = createContext<LanguageProviderState>(initialState)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const loggedIn = useSelector(selectIsLoggedIn)
    const [uiLanguage, setUiLanguageState] = useState<AppLanguage>(() => getStoredUiLanguage())
    const [documentLanguage, setDocumentLanguageState] = useState<AppLanguage>(() => getStoredDocumentLanguage())
    const { data: settingsData, isLoading: settingsLoading } = useGetSettingsQuery(undefined, { skip: !loggedIn })
    const [updateSettings] = useUpdateSettingsMutation()

    useEffect(() => {
        if (!settingsData?.settings?.documentLanguage) return
        const lang = settingsData.settings.documentLanguage
        setDocumentLanguageState(lang)
        setStoredDocumentLanguage(lang)
    }, [settingsData])

    useEffect(() => {
        const root = document.documentElement
        root.lang = uiLanguage
        root.dir = uiLanguage === 'ur' ? 'rtl' : 'ltr'
        root.classList.toggle('lang-ur', uiLanguage === 'ur')
    }, [uiLanguage])

    const setUiLanguage = useCallback((lang: AppLanguage) => {
        setStoredUiLanguage(lang)
        setUiLanguageState(lang)
    }, [])

    const setDocumentLanguage = useCallback(
        async (lang: AppLanguage) => {
            setStoredDocumentLanguage(lang)
            setDocumentLanguageState(lang)
            await updateSettings({ documentLanguage: lang }).unwrap()
        },
        [updateSettings]
    )

    const value = useMemo<LanguageProviderState>(
        () => ({
            uiLanguage,
            documentLanguage,
            dir: uiLanguage === 'ur' ? 'rtl' : 'ltr',
            t: getTranslations(uiLanguage),
            setUiLanguage,
            setDocumentLanguage,
            format: interpolate,
            settingsLoading: loggedIn ? settingsLoading : false
        }),
        [uiLanguage, documentLanguage, setUiLanguage, setDocumentLanguage, settingsLoading, loggedIn]
    )

    return <LanguageProviderContext.Provider value={value}>{children}</LanguageProviderContext.Provider>
}
