import type { RootState } from '../store'

export const selectInspector = (state: RootState) => state.inspector.inspector
