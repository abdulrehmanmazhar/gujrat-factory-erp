import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import playwrightIcon from '@/assets/playwright-logo.svg'
import browserIcon from '@/assets/chrome-logo.webp'
import { AlertOctagon, Globe, Server, GitBranch } from 'lucide-react'
// import { useSelector } from 'react-redux'
// import { selectProcessStdOut } from '@/redux/selector/process'
// import { useReactFlow } from 'reactflow'
import { useDispatch } from 'react-redux'
import { setInspector } from '@/redux/slice/inspector'
import { updateSelectedData, updateSelectedNode } from '@/redux/slice/node'
import {
    defaultInterruptionAction,
    defaultLaunchBrowserAction,
    defaultNetworkInterceptorAction,
    defaultPlaywrightAction,
    defaultServerAction
} from '@/constants/actions'

function FloatingToolbar() {
    // const stdio = useSelector(selectProcessStdOut)

    // const { setNodes } = useReactFlow()

    // console.log(stdio)
    const tools = [
        {
            icon: (
                <img
                    src={playwrightIcon}
                    alt=""
                    className="h-5 w-5"
                />
            ),
            label: 'Playwright Action',
            description: 'Browser automation actions like click, fill, hover, press, etc.'
        },
        {
            icon: (
                <img
                    src={browserIcon}
                    alt=""
                    className="h-5 w-5"
                />
            ),
            label: 'Browser Session',
            description: 'Launch and manage browser sessions'
        },
        {
            icon: <Globe className="h-5 w-5 text-sky-400" />,
            label: 'Network Interceptor',
            description: 'Intercept HTTP/WebSocket requests and responses'
        },
        {
            icon: <AlertOctagon className="h-5 w-5 text-destructive" />,
            label: 'Interruption',
            description: 'Wait for conditions with timeout and resolution'
        },
        {
            icon: <Server className="h-5 w-5 text-purple-500" />,
            label: 'Server Action',
            description: 'Execute custom or built-in server-side actions'
        },
        // Future: Control Flow Action
        {
            icon: <GitBranch className="h-5 w-5 text-emerald-500" />,
            label: 'Control Flow',
            description: 'If-else, loops, and switch cases for workflow logic'
        }
    ]

    const dispatch = useDispatch()

    const clickHandler = (tool: (typeof tools)[0]) => {
        dispatch(updateSelectedNode(null))
        switch (tool.label) {
            case 'Playwright Action':
                dispatch(updateSelectedData({ action: defaultPlaywrightAction, type: 'playwrightAction' }))
                break

            case 'Browser Session':
                dispatch(updateSelectedData({ action: defaultLaunchBrowserAction, type: 'browserAction' }))
                break

            case 'Network Interceptor':
                dispatch(updateSelectedData({ action: defaultNetworkInterceptorAction, type: 'networkInterceptor' }))
                break

            case 'Interruption':
                dispatch(updateSelectedData({ action: defaultInterruptionAction, type: 'interruptionAction' }))
                break

            case 'Server Action':
                dispatch(updateSelectedData({ action: defaultServerAction, type: 'serverAction' }))
                break

            default:
                dispatch(updateSelectedData(null))
                break
        }

        dispatch(setInspector(true))
    }

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-2 p-2 rounded-2xl border bg-background shadow-md">
                {tools.map((tool) => (
                    <Tooltip key={tool.label}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10"
                                onClick={
                                    () => clickHandler(tool)
                                    //     () => {
                                    //     // Handle drag or add node logic here
                                    //     setNodes((prev) => [
                                    //         ...prev,
                                    //         {
                                    //             id: `${tool.label}-${Date.now()}`,
                                    //             type: 'playwrightAction', // This should be dynamic based on tool type
                                    //             position: { x: 250, y: 5 },
                                    //             data: {
                                    //                 name: 'click',
                                    //                 button: 'left',
                                    //                 modifiers: 0,
                                    //                 clickCount: 2
                                    //             }
                                    //         }
                                    //     ])
                                    // }
                                }>
                                {tool.icon}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent
                            side="right"
                            className="flex flex-col gap-1">
                            <p className="font-medium">{tool.label}</p>
                            <p className="text-xs text-muted-foreground">{tool.description}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    )
}

export default FloatingToolbar
