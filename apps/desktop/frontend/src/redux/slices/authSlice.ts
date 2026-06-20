import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/types/api'

const USER_KEY = 'erp_user'

function loadUser(): User | null {
    try {
        const raw = localStorage.getItem(USER_KEY)
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
    user: loadUser(),
    loggedIn: !!loadUser(),
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
            localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
        },
        logout: (state) => {
            state.user = null
            state.loggedIn = false
            state.token = null
            localStorage.removeItem(USER_KEY)
        }
    }
})

export const { setCredentials, logout } = authSlice.actions
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user
export const selectIsLoggedIn = (state: { auth: AuthState }) => state.auth.loggedIn
export default authSlice.reducer
