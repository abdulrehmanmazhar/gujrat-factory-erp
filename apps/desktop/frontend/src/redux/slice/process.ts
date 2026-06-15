import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface processState {
    stdout: Record<number, unknown>
    processes: {
        name: 'chrome' | string
        id: number
        pid: number
    }[]
    selectedProcess: number | null
}

const initialState: processState = {
    stdout: {},
    processes: [],
    selectedProcess: null
}

const processSlice = createSlice({
    name: 'process',
    initialState,
    reducers: {
        addProcess: (state, action: PayloadAction<{ name: string; id: number; pid: number }>) => {
            state.processes = [...state.processes, action.payload]
        },
        deleteProcess: (state, action: PayloadAction<{ id: number }>) => {
            state.processes = state.processes.filter((process) => process.id !== action.payload.id)
            delete state.stdout[action.payload.id]
        },
        updateProcessIO: (state, action: PayloadAction<{ id: number; stdout: unknown }>) => {
            state.stdout = { ...state.stdout, [action.payload.id]: action.payload.stdout }
        },
        setSelectedProcess: (state, action: PayloadAction<{ id: number }>) => {
            state.selectedProcess = action.payload.id
        }
    }
})

export default processSlice.reducer
export const { addProcess, deleteProcess, updateProcessIO, setSelectedProcess } = processSlice.actions
