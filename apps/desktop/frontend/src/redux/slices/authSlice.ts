import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/types/api'

const USER_KEY = 'erp_user'

async function loadUser(): Promise<User | null> {
    try {
        const raw = await window.platform.storage.getData(USER_KEY)
        return raw ? (JSON.parse(raw) as User) : null
    } catch {
        return null
    }
}

interface AuthState {
    user: User | null
    loggedIn: boolean
    token: string | null
}

const initialState: AuthState = {
    user: await loadUser(),
    loggedIn: !!(await loadUser()),
    token: null
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (state, action: PayloadAction<{ user: User; accessToken?: string }>) => {
            state.user = action.payload.user
            state.loggedIn = true
            state.token = action.payload.accessToken ?? null
            // localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
            window.platform.storage.setData(USER_KEY, JSON.stringify(action.payload.user)).catch((err) => {
                console.error('Failed to save user data to Neutralino storage:', err)
            })
        },
        logout: (state) => {
            state.user = null
            state.loggedIn = false
            state.token = null
            // localStorage.removeItem(USER_KEY)
            window.platform.storage.removeData(USER_KEY).catch((err) => {
                console.error('Failed to remove user data from Neutralino storage:', err)
            })
        }
    }
})

export const { setCredentials, logout } = authSlice.actions
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token
export const selectIsLoggedIn = (state: { auth: AuthState }) => state.auth.loggedIn
export default authSlice.reducer
