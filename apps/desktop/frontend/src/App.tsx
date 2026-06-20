import { HashRouter } from 'react-router-dom'
import { Provider, useSelector } from 'react-redux'
import { ThemeProvider } from '@/context/ThemeProvider'
import { AuthPage } from '@/components/auth/AuthPage'
import { selectIsLoggedIn } from '@/redux/slices/authSlice'
import store from '@/redux/store'
import Router from '@/router'
import { Toaster } from '@/components/ui/sonner'

function AppRoutes() {
    const loggedIn = useSelector(selectIsLoggedIn)
    return loggedIn ? <Router /> : <AuthPage />
}

export default function App() {
    return (
        <Provider store={store}>
            <ThemeProvider
                defaultTheme="light"
                storageKey="erp-ui-theme">
                <HashRouter>
                    <AppRoutes />
                    <Toaster richColors />
                </HashRouter>
            </ThemeProvider>
        </Provider>
    )
}
