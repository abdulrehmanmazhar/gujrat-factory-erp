import type { RootState } from '@/redux/store'
import { createSelector } from 'reselect'

export const selectAllProcesses = (state: RootState) => state.process.processes

export const selectAllProcessesStdOut = (state: RootState) => state.process.stdout

export const selectSelectedProcess = (state: RootState) => state.process.selectedProcess

export const selectProcessStdOut = createSelector([selectAllProcessesStdOut, selectSelectedProcess], (processStdouts, selectedProcess) => {
    if (!selectedProcess) return {}
    return processStdouts[selectedProcess]
})
