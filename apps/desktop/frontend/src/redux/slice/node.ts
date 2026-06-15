import type { TAction } from '@/types/actions'
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface nodeState {
    selectedData: {
        action: TAction
        type: 'playwrightAction' | 'browserAction' | 'networkInterceptor' | 'serverAction' | 'interruptionAction' | 'controlFlowAction'
    } | null
    selectedNode: unknown | null
}

const initialState: nodeState = {
    selectedData: null,
    selectedNode: null
}

const nodeSlice = createSlice({
    name: 'node',
    initialState,
    reducers: {
        updateSelectedData: (state, action: PayloadAction<nodeState['selectedData']>) => {
            state.selectedData = action.payload
        },
        updateSelectedNode: (state, action: PayloadAction<unknown | null>) => {
            state.selectedNode = action.payload
        }
    }
})

export default nodeSlice.reducer
export const { updateSelectedData, updateSelectedNode } = nodeSlice.actions
