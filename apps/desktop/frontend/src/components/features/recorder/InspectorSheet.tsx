import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import PlaywrightSheet from './PlaywrightSheet'
import BrowserSheet from './BrowserSheet'
import ServerSheet from './ServerSheet'
import NetworkSheet from './NetworkSheet'
import InterruptionSheet from './InterruptionSheet'
import type {
    TPlaywrightAction,
    LaunchBrowserAction,
    CloseBrowserAction,
    TServerAction,
    TNetworkInterceptorAction,
    TInterruptionAction,
    TBrowserAction
} from '@/types/actions'
import { useDispatch, useSelector } from 'react-redux'
import { selectInspector } from '@/redux/selector/inspector'
import { setInspector } from '@/redux/slice/inspector'
import { selectSelectedNode, selectSelectedNodeData } from '@/redux/selector/node'
import { useReactFlow } from 'reactflow'
import { showSuccessToast } from '@/utils/notifications'

function InspectorSheet() {
    const { setNodes } = useReactFlow()

    const dispatch = useDispatch()

    const open = useSelector(selectInspector)

    const selectedNode = useSelector(selectSelectedNode)

    const selectedNodeData = useSelector(selectSelectedNodeData)

    const setOpen = (state: boolean) => {
        dispatch(setInspector(state))
    }

    const createNewNode = (params: typeof selectedNodeData) => {
        if (!params) return

        setNodes((prev) => [...prev, { id: crypto.randomUUID(), data: params.action, type: params.type, position: { x: 100, y: 200 } }])

        showSuccessToast(`Created ${params.type} Node`)
    }

    const handlePlaywrightUpdate = (action: TPlaywrightAction) => {
        if (selectedNode === null) {
            createNewNode({ action, type: 'playwrightAction' })
        } else {
            setNodes((prev) =>
                prev.map((node) => {
                    if (node.id === selectedNode) {
                        return {
                            ...node,
                            data: action
                        }
                    } else {
                        return node
                    }
                })
            )

            showSuccessToast(`Modified playwrightAction Node`)
        }

        setOpen(false)
    }

    const handleBrowserUpdate = (action: LaunchBrowserAction | CloseBrowserAction) => {
        if (selectedNode === null) {
            createNewNode({ action, type: 'browserAction' })
        } else {
            setNodes((prev) =>
                prev.map((node) => {
                    if (node.id === selectedNode) {
                        return {
                            ...node,
                            data: action
                        }
                    } else {
                        return node
                    }
                })
            )

            showSuccessToast(`Modified browserAction Node`)
        }

        setOpen(false)
    }

    const handleServerUpdate = (action: TServerAction) => {
        if (selectedNode === null) {
            createNewNode({ action, type: 'serverAction' })
        } else {
            setNodes((prev) =>
                prev.map((node) => {
                    if (node.id === selectedNode) {
                        return {
                            ...node,
                            data: action
                        }
                    } else {
                        return node
                    }
                })
            )

            showSuccessToast(`Modified serverAction Node`)
        }

        setOpen(false)
    }

    const handleNetworkUpdate = (action: TNetworkInterceptorAction) => {
        if (selectedNode === null) {
            createNewNode({ action, type: 'networkInterceptor' })
        } else {
            setNodes((prev) =>
                prev.map((node) => {
                    if (node.id === selectedNode) {
                        return {
                            ...node,
                            data: action
                        }
                    } else {
                        return node
                    }
                })
            )

            showSuccessToast(`Modified networkInterceptor Node`)
        }

        setOpen(false)
    }

    const handleInterruptionUpdate = (action: TInterruptionAction) => {
        if (selectedNode === null) {
            createNewNode({ action, type: 'interruptionAction' })
        } else {
            setNodes((prev) =>
                prev.map((node) => {
                    if (node.id === selectedNode) {
                        return {
                            ...node,
                            data: action
                        }
                    } else {
                        return node
                    }
                })
            )

            showSuccessToast(`Modified interruptionAction Node`)
        }

        setOpen(false)
    }

    const renderConditionalContent = () => {
        if (!selectedNodeData) {
            return <div className="text-center text-gray-500 mt-8">No selected data is available</div>
        }

        const { type, action } = selectedNodeData

        switch (type) {
            case 'playwrightAction':
                return (
                    <PlaywrightSheet
                        action={action as TPlaywrightAction}
                        onUpdate={handlePlaywrightUpdate}
                    />
                )

            case 'browserAction':
                return (
                    <BrowserSheet
                        action={action as TBrowserAction}
                        onUpdate={handleBrowserUpdate}
                    />
                )

            case 'networkInterceptor':
                return (
                    <NetworkSheet
                        action={action as TNetworkInterceptorAction}
                        onUpdate={handleNetworkUpdate}
                    />
                )

            case 'serverAction':
                return (
                    <ServerSheet
                        action={action as TServerAction}
                        onUpdate={handleServerUpdate}
                    />
                )

            case 'interruptionAction':
                return (
                    <InterruptionSheet
                        action={action as TInterruptionAction}
                        onUpdate={handleInterruptionUpdate}
                    />
                )

            case 'controlFlowAction':
                return <div className="text-center text-gray-500 mt-8">Control Flow Action is not yet implemented</div>

            default:
                return <div className="text-center text-gray-500 mt-8">Unknown action type: {type}</div>
        }
    }

    return (
        <Sheet
            open={open}
            onOpenChange={setOpen}>
            <SheetContent
                side="right"
                className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Inspector</SheetTitle>
                </SheetHeader>
                <div className="px-3 mb-6">{renderConditionalContent()}</div>
            </SheetContent>
        </Sheet>
    )
}

export default InspectorSheet
