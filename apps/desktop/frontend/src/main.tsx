import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Provider } from 'react-redux'
import store from './redux/store'
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {window.NL_PORT ? (
            <Provider store={store}>
                <App />
            </Provider>
        ) : (
            <div>
                <p>Cannot open the application</p>
            </div>
        )}
    </StrictMode>
)
