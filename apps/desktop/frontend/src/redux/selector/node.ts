import type { RootState } from '../store'

export const selectSelectedNodeData = (state: RootState) => state.node.selectedData

export const selectSelectedNode = (state: RootState) => state.node.selectedNode
