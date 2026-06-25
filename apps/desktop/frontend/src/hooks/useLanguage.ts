import { useContext } from 'react'
import { LanguageProviderContext } from '@/context/LanguageProvider'

export function useLanguage() {
    const context = useContext(LanguageProviderContext)
    if (!context) throw new Error('useLanguage must be used within LanguageProvider')
    return context
}
