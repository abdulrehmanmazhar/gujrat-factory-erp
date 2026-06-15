import { HashRouter } from 'react-router-dom'
import ShadcnSidebarLayout from './components/features/layout'
import { ThemeProvider } from './context/ThemeProvider'
import Router from './router'
import { ReactFlowProvider } from 'reactflow'
import useProcessStdoutListener from './hooks/useProcessStdoutListener'
import { Toaster } from './components/ui/sonner'

function App() {
    useProcessStdoutListener()

    return (
        <>
            <ThemeProvider>
                <ReactFlowProvider>
                    <HashRouter>
                        <ShadcnSidebarLayout>
                            <Router />
                            <Toaster />
                        </ShadcnSidebarLayout>
                    </HashRouter>
                </ReactFlowProvider>
            </ThemeProvider>
        </>
    )
}

export default App
