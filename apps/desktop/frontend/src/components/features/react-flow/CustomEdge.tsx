import { X } from 'lucide-react'
import { EdgeLabelRenderer, getBezierPath, useReactFlow, useStore, type EdgeProps } from 'reactflow'

function CustomEdge(props: EdgeProps) {
    const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition
    })

    const { setEdges } = useReactFlow()
    const isLocked = useStore((state) => !state.nodesDraggable && !state.nodesConnectable) // Accessing the isLocked state from the store

    const filterEdge = (edgeId: string) => {
        if (isLocked) return // Prevent edge deletion when the graph is locked
        setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== edgeId))
    }

    return (
        <>
            <path
                id={props.id}
                d={edgePath}
                className="stroke-gray-400 stroke-2 fill-none"
            />
            {!isLocked && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'all'
                        }}
                        className="nodrag nopan">
                        <button
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition"
                            onClick={() => filterEdge(props.id)}>
                            <X size={12} />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
}

export default CustomEdge
