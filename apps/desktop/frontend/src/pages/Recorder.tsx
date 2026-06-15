import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Play, Square, Save } from 'lucide-react'
import Header from '@/components/features/header'
import ReactFlowCanvas from '@/components/features/react-flow/ReactFlowCanvas'
import FloatingToolbar from '@/components/features/recorder/FloatingToolbar'
import { runCodegen } from '@/utils/codegen'
import { useDispatch, useSelector } from 'react-redux'
import { selectAllProcesses } from '@/redux/selector/process'
import { addProcess } from '@/redux/slice/process'
import { showErrorToast, showSuccessToast } from '@/utils/notifications'
import InspectorSheet from '@/components/features/recorder/InspectorSheet'
import { useParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { getWorkflowGraphById, setWorkflowGraph } from '@/utils/storage'
import { useReactFlow } from 'reactflow'
import type { TWorkflowGraph } from '@/types/storage'
import useChromeKillListener from '@/hooks/useChromeKillListener'
import { platform } from '@/utils/platform'
import { dataArrayToLinearGraph } from '@/utils/graphGenerator'
import { checkPathExists } from '@/utils/appPaths'

export default function Recorder() {
    const dispatch = useDispatch()

    const { setNodes, setEdges, getNodes, getEdges } = useReactFlow()

    const processes = useSelector(selectAllProcesses)

    const isRecording = processes.some((p) => p.name === 'chrome')

    const { id } = useParams()

    const onChromeKill = async () => {
        if (!id) return
        const tempPath = await platform.os.getPath('temp')

        const targetFolder = `${tempPath}/${id}`

        if (!(await checkPathExists(targetFolder))) return

        const actionFilePath = `${targetFolder}/actions.jsonl`

        if (!(await checkPathExists(actionFilePath))) {
            showErrorToast('Action file not found')
            return
        }

        const content = await platform.filesystem.readFile(actionFilePath)

        const lines = content
            .trim()
            .split('\n')
            .filter((line) => line.trim())

        const [, ...filteredLines] = lines
            .map((line) => {
                try {
                    return JSON.parse(line)
                } catch (error) {
                    console.error(`Failed to parse line: ${line}`, error)
                    return null
                }
            })
            .filter((v): v is NonNullable<typeof v> => !!v)

        const graph = dataArrayToLinearGraph(filteredLines)

        setNodes(graph.nodes)
        setEdges(graph.edges)
    }

    useChromeKillListener(onChromeKill)

    const onRecording = async () => {
        try {
            if (!id) throw new Error('ID not found')
            if (!processes.some((p) => p.name === 'chrome')) {
                const process = await runCodegen(id)
                dispatch(addProcess({ id: process.id, pid: process.pid, name: 'chrome' }))
                showSuccessToast('Chrome spawned successfully')
            } else {
                const process = processes.find((p) => p.name === 'chrome')
                if (!process) return
                // await killCodegen(process.pid)
                // showSuccessToast('Chrome closed successfully')
                showErrorToast('Use the close button in chome')
            }
        } catch (error) {
            showErrorToast(error instanceof Error ? error.message : 'Unexpected error occured')
            console.error(error)
        }
    }

    const lastCallTimeRef = useRef<number>(0)

    useEffect(() => {
        if (!id) return

        const now = Date.now()
        const timeSinceLastCall = now - lastCallTimeRef.current

        if (timeSinceLastCall < 10000) {
            return
        }

        lastCallTimeRef.current = now

        getWorkflowGraphById(id)
            .then((graph) => {
                if (graph) {
                    console.log('Loaded workflow graph:', graph)
                    setNodes(graph.nodes)
                    setEdges(graph.edges)
                }
            })
            .catch((error) => {
                console.error('Error loading workflow graph:', error)
            })
    }, [id]) // Added id to dependencies for better reliability

    const saveHandler = async () => {
        try {
            if (!id) throw new Error('Id not found')

            await setWorkflowGraph(id, {
                nodes: getNodes() as unknown as TWorkflowGraph['nodes'],
                edges: getEdges() as unknown as TWorkflowGraph['edges']
            })
            showSuccessToast('Workflow Graph saved successfully')
        } catch (error) {
            showErrorToast(`${error instanceof Error ? error.message : 'Unexpected error occured'}`)
        }
    }

    return (
        <div className="flex h-full bg-muted/40 text-foreground">
            <div className="flex-1 flex flex-col">
                {/* Top Bar */}
                <Header
                    title="Recorder"
                    subtitle="Manage your workflow actions"
                    actions={
                        <div className="flex items-center gap-2">
                            <Button
                                variant={isRecording ? 'destructive' : 'default'}
                                onClick={onRecording}>
                                {isRecording ? <Square size={16} /> : <Play size={16} />}
                                <span className="ml-2">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                            </Button>

                            <Button
                                variant="outline"
                                onClick={saveHandler} // ← Fixed: onClick moved here
                            >
                                <Save
                                    size={16}
                                    className="mr-2"
                                />
                                Save
                            </Button>
                        </div>
                    }
                />

                {/* Content */}
                <div className="flex flex-1 relative overflow-hidden">
                    {/* Floating Toolbar (Photoshop style) */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                        <FloatingToolbar />
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <ReactFlowCanvas />
                    </div>
                </div>
            </div>

            {/* Inspector Sheet */}
            <InspectorSheet />
        </div>
    )
}
