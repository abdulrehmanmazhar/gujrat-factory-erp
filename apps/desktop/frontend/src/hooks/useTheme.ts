import { useContext } from 'react'
import { ThemeProviderContext } from '@/context/ThemeProvider'

export function useTheme() {
    const context = useContext(ThemeProviderContext)
    if (!context) throw new Error('useTheme must be used within ThemeProvider')
    return context
}
