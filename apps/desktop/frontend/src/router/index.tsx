import { Route, Routes } from 'react-router-dom'
import NotFound from '@/pages/NotFound'
import Home from '@/pages/Home'
import Recorder from '@/pages/Recorder'
import SettingsPage from '@/pages/Setting'
// import ShadcnSidebarLayout from '@/components/features/layout'

const Router = () => {
    return (
        <Routes>
            <Route
                path="/"
                element={<Home />}
            />
            <Route
                path="/dashboard"
                element={<Home />}
            />
            <Route
                path="/recorder/:id"
                element={<Recorder />}
            />
            <Route
                path="/setting"
                element={<SettingsPage />}
            />
            <Route
                path="*"
                element={<NotFound />}
            />
        </Routes>
    )
}

export default Router
