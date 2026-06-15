import { addEdge, Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState, useStore, type Connection } from 'reactflow'
import 'reactflow/dist/style.css'
import PlaywrightAction from './PlaywrightAction'
// import { browserDummyNodes as nodes } from '@/constants/actions'
// import { browserWorkflowNodes as nodes } from '@/constants/actions'
// import { playWrightActionNodes as dummyNodes } from '@/constants/actions'
// import { networkInterceptorDummyNodes as nodes } from '@/constants/actions'
// import { networkWorkflowNodes as nodes } from '@/constants/actions'
// import { interruptionDummyNodes as nodes } from '@/constants/actions'
// import { serverActionDummyNodes as nodes } from '@/constants/actions'
import BrowserSessionAction from './BrowserSessionAction'
import NetworkInterceptorAction from './NetworkInterceptorAction'
import ServerAction from './ServerAction'
import InterruptionAction from './InterruptionAction'
import ControlFlowAction from './ControlFlowAction'
import CustomEdge from './CustomEdge'

const nodeTypes = {
    playwrightAction: PlaywrightAction,
    browserAction: BrowserSessionAction,
    networkInterceptor: NetworkInterceptorAction,
    serverAction: ServerAction,
    interruptionAction: InterruptionAction,
    controlFlowAction: ControlFlowAction
}

const edgeTypes = {
    customEdge: CustomEdge
}

function ReactFlowCanvas() {
    const [nodes, , onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    // console.log('Rendering ReactFlowCanvas with nodes:')

    const isLocked = useStore((state) => !state.nodesDraggable && !state.nodesConnectable)

    const onConnect = (connection: Connection) => {
        if (isLocked) return // Prevent edge creation when the graph is locked
        const edge = { ...connection, id: `${connection.source}-${connection.target}`, type: 'customEdge' }
        setEdges((prev) => addEdge(edge, prev))
    }
    return (
        <ReactFlow
            fitView
            multiSelectionKeyCode={null}
            selectionOnDrag={false}
            panOnDrag={true}
            nodes={nodes}
            onNodesChange={onNodesChange}
            edges={edges}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            proOptions={{ hideAttribution: true }}>
            <Background />
            <Controls position={'bottom-right'} />
            <MiniMap position="top-right" />
        </ReactFlow>
    )
}

export default ReactFlowCanvas
