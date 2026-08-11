import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { apiSlice } from '@/redux/api/apiSlice'
import authReducer from '@/redux/slices/authSlice'
import '@/redux/api/authApi'
import '@/redux/api/customersApi'
import '@/redux/api/productsApi'
import '@/redux/api/ordersApi'
import '@/redux/api/usersApi'
import '@/redux/api/suppliersApi'
import '@/redux/api/restockApi'
import '@/redux/api/recipesApi'
import '@/redux/api/conversionsApi'
import '@/redux/api/labourApi'
import '@/redux/api/backupApi'
import '@/redux/api/settingsApi'
import '@/redux/api/analyticsApi'
import '@/redux/api/aiApi'
import '@/redux/api/miscExpenditureApi'
import '@/redux/api/categoriesApi'
import '@/redux/api/khataApi'

export const store = configureStore({
    reducer: {
        auth: authReducer,
        [apiSlice.reducerPath]: apiSlice.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware)
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export default store
