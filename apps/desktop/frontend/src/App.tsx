import { useEffect, useState } from 'react'
import { HashRouter } from 'react-router-dom'
import { Provider, useSelector } from 'react-redux'
import { ThemeProvider } from '@/context/ThemeProvider'
import { AuthPage } from '@/components/auth/AuthPage'
import { SplashScreen } from '@/components/SplashScreen'
import { selectIsLoggedIn } from '@/redux/slices/authSlice'
import store from '@/redux/store'
import Router from '@/router'
import { Toaster } from '@/components/ui/sonner'
import { ensureServerReady, getServerPort } from '@/lib/server'

function AppRoutes() {
    const loggedIn = useSelector(selectIsLoggedIn)
    return loggedIn ? <Router /> : <AuthPage />
}

function AppShell() {
    return (
        <ThemeProvider
            defaultTheme="light"
            storageKey="erp-ui-theme">
            <HashRouter>
                <AppRoutes />
                <Toaster richColors />
            </HashRouter>
        </ThemeProvider>
    )
}

export default function App() {
    const [ready, setReady] = useState(false)
    const [status, setStatus] = useState('Initializing...')
    const [error, setError] = useState(false)

    useEffect(() => {
        let active = true

        ensureServerReady(getServerPort(), (message) => {
            if (active) setStatus(message)
        })
            .then(() => {
                if (active) setReady(true)
            })
            .catch((err: unknown) => {
                if (!active) return
                setError(true)
                setStatus(err instanceof Error ? err.message : 'Unable to connect to the server')
            })

        return () => {
            active = false
        }
    }, [])

    if (!ready) {
        return (
            <SplashScreen
                status={status}
                error={error}
            />
        )
    }

    return (
        <Provider store={store}>
            <AppShell />
        </Provider>
    )
}
