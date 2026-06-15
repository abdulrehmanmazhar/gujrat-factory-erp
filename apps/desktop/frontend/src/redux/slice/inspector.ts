import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface inspectorState {
    inspector: boolean
}

const initialState: inspectorState = {
    inspector: false
}

const inspectorSlice = createSlice({
    name: 'inspector',
    initialState,
    reducers: {
        setInspector: (state, action: PayloadAction<boolean>) => {
            state.inspector = action.payload
        }
    }
})

export default inspectorSlice.reducer
export const { setInspector } = inspectorSlice.actions
