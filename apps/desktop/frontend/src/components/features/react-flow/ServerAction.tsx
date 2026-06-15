import type { BuiltInServerAction, CustomServerAction, TServerAction } from '@/types/actions'
import { Handle, Position, useReactFlow, useStore, type NodeProps } from 'reactflow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Server, Code, Wrench, X } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { selectSelectedNode, selectSelectedNodeData } from '@/redux/selector/node'
import { updateSelectedData, updateSelectedNode } from '@/redux/slice/node'
import { setInspector } from '@/redux/slice/inspector'

// Helper function to get action-specific details
const getActionDetails = (action: TServerAction) => {
    const isCustom = action.type === 'custom'

    return {
        label: 'Server Action',
        badgeIcon: isCustom ? Code : Wrench,
        badgeVariant: isCustom ? ('default' as const) : ('secondary' as const),
        isCustom,
        runtimeEnvRef: action.runtimeEnvRef,
        action: action.action
    }
}

function ServerAction({ data, id }: NodeProps<TServerAction>) {
    const { label, badgeIcon: BadgeIcon, badgeVariant, isCustom, runtimeEnvRef, action } = getActionDetails(data)

    const { setNodes } = useReactFlow()
    const isLocked = useStore((state) => !state.nodesDraggable && !state.nodesConnectable) // Accessing the isLocked state from the store

    const filterNodes = (nodeId: string) => {
        if (isLocked) return // Prevent node deletion when the graph is locked
        setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeId))
    }

    const selectedNodeId = useSelector(selectSelectedNode)
    const selectedNodeData = useSelector(selectSelectedNodeData)

    const dispatch = useDispatch()

    const isSelected = selectedNodeId === id && selectedNodeData && selectedNodeData.type === 'serverAction'

    const clickHandler = () => {
        dispatch(updateSelectedNode(id))
        dispatch(updateSelectedData({ action: data, type: 'serverAction' }))
        dispatch(setInspector(true))
    }

    return (
        <div className="relative group">
            {/* Close Button - Always visible */}
            {!isLocked && (
                <div className="nodrag nopan absolute -top-2 -right-2 z-10">
                    <button
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-all hover:scale-110"
                        onClick={() => filterNodes(id)}>
                        <X size={14} />
                    </button>
                </div>
            )}
            {/* Target Handle (Top) */}
            <Handle
                type="target"
                position={Position.Top}
                className="bg-border hover:bg-primary transition-colors w-3 h-3 border-2 border-background"
            />

            {/* Source Handle (Bottom) */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="bg-border hover:bg-primary transition-colors w-3 h-3 border-2 border-background"
            />

            {/* Main Card */}
            <Card
                className={`w-65 transition-all ${isSelected ? 'shadow-lg shadow-primary/50 ring-2 ring-primary ring-offset-2' : ''}`}
                onClick={clickHandler}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <Server className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    </div>
                    <Badge
                        variant={badgeVariant}
                        className="text-xs px-2 py-0.5 gap-1">
                        <BadgeIcon className="w-3 h-3" />
                    </Badge>
                </CardHeader>

                <CardContent className="pt-2">
                    <div className="text-xs text-muted-foreground">
                        {isCustom ? (
                            <>
                                {(action as CustomServerAction['action']).method} •{' '}
                                {(action as CustomServerAction['action']).url.length > 40
                                    ? `${(action as CustomServerAction['action']).url.substring(0, 40)}...`
                                    : (action as CustomServerAction['action']).url}
                            </>
                        ) : (
                            <>Get OTP • Timeout: {(action as BuiltInServerAction['action']).timeout}ms</>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Runtime: {runtimeEnvRef}</div>
                </CardContent>
            </Card>
        </div>
    )
}

export default ServerAction
