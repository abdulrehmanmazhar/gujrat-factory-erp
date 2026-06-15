import { configureStore } from '@reduxjs/toolkit'
import processReducer from './slice/process'
import nodeReducer from './slice/node'
import inspectorReducer from './slice/inspector'

const store = configureStore({
    reducer: {
        process: processReducer,
        node: nodeReducer,
        inspector: inspectorReducer
    },
    devTools: true
    // middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat()
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store
