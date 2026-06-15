import type { TBrowserAction, LaunchBrowserAction } from '@/types/actions'
import { Handle, Position, useReactFlow, useStore, type NodeProps } from 'reactflow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Globe, Power, Settings, Monitor, Shield, Clock, Network, PowerOff, X } from 'lucide-react'
import chromeIcon from '@/assets/chrome-logo.webp'
import { useDispatch, useSelector } from 'react-redux'
import { selectSelectedNode, selectSelectedNodeData } from '@/redux/selector/node'
import { updateSelectedData, updateSelectedNode } from '@/redux/slice/node'
import { setInspector } from '@/redux/slice/inspector'

// Helper to get browser channel icon and label (always chromium/chrome)
const getBrowserChannelInfo = () => {
    return {
        icon: chromeIcon,
        label: 'Chromium'
    }
}

// Get configuration summary for display
const getConfigSummary = (config: LaunchBrowserAction['config']) => {
    const summary = []

    if (config.launch.headless !== undefined) {
        summary.push({
            icon: Monitor,
            label: 'Headless',
            value: config.launch.headless ? 'Yes' : 'No'
        })
    }

    if (config.launch.devtools) {
        summary.push({
            icon: Settings,
            label: 'DevTools',
            value: 'Enabled'
        })
    }

    if (config.launch.slowMo && config.launch.slowMo > 0) {
        summary.push({
            icon: Clock,
            label: 'Slow Mo',
            value: `${config.launch.slowMo}ms`
        })
    }

    if (config.launch.ignoreHTTPSErrors) {
        summary.push({
            icon: Shield,
            label: 'Ignore HTTPS Errors',
            value: 'Yes'
        })
    }

    if (config.launch.proxy) {
        summary.push({
            icon: Network,
            label: 'Proxy',
            value: config.launch.proxy.server
        })
    }

    return summary.slice(0, 3) // Limit to top 3 for display
}

// Helper to get action-specific details
const getActionDetails = (action: TBrowserAction) => {
    if (action.name === 'launchBrowser') {
        const channelInfo = getBrowserChannelInfo()
        const summary = getConfigSummary(action.config)
        const hasCustomConfig = Object.keys(action.config.launch).length > 3 // More than default props

        return {
            label: 'Launch Browser',
            icon: Power,
            badgeIcon: Power,
            badgeVariant: 'default' as const,
            channelIcon: channelInfo.icon,
            channelLabel: channelInfo.label,
            configSummary: summary,
            hasCustomConfig,
            details: `Channel: ${channelInfo.label}${action.config.launch.headless ? ' • Headless' : ''}${action.config.launch.devtools ? ' • DevTools' : ''}`
        }
    } else {
        return {
            label: 'Close Browser',
            icon: Globe,
            badgeIcon: PowerOff,
            badgeVariant: 'destructive' as const,
            channelIcon: null,
            channelLabel: null,
            configSummary: [],
            hasCustomConfig: false,
            details: 'Terminate browser session and clean up resources'
        }
    }
}

function BrowserSessionAction({ data, id }: NodeProps<TBrowserAction>) {
    const { label, badgeIcon: BadgeIcon, badgeVariant, configSummary, hasCustomConfig, details } = getActionDetails(data)

    // Launch action has source handle only (bottom)
    // Close action has target handle only (top)
    const isLaunch = data.name === 'launchBrowser'
    const isClose = data.name === 'closeBrowser'

    const { setNodes } = useReactFlow()
    const isLocked = useStore((state) => !state.nodesDraggable && !state.nodesConnectable) // Accessing the isLocked state from the store

    const filterNodes = (nodeId: string) => {
        if (isLocked) return // Prevent node deletion when the graph is locked
        setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeId))
    }

    const selectedNodeId = useSelector(selectSelectedNode)
    const selectedNodeData = useSelector(selectSelectedNodeData)

    const dispatch = useDispatch()

    const isSelected = selectedNodeId === id && selectedNodeData && selectedNodeData.type === 'browserAction'

    const clickHandler = () => {
        dispatch(updateSelectedNode(id))
        dispatch(updateSelectedData({ action: data, type: 'browserAction' }))
        dispatch(setInspector(true))
    }

    return (
        <TooltipProvider>
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
                {/* Source Handle (Bottom) - Only for Launch action */}
                {isLaunch && (
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        className="bg-border hover:bg-primary transition-colors w-3 h-3 border-2 border-background"
                    />
                )}

                {/* Target Handle (Top) - Only for Close action */}
                {isClose && (
                    <Handle
                        type="target"
                        position={Position.Top}
                        className="bg-border hover:bg-primary transition-colors w-3 h-3 border-2 border-background"
                    />
                )}

                {/* Main Card - removed shadow classes */}
                <Card
                    className={`w-70 transition-all ${isSelected ? 'shadow-lg shadow-primary/50 ring-2 ring-primary ring-offset-2' : ''}`}
                    onClick={clickHandler}>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            {/* Browser Icon - always chrome icon */}
                            <img
                                src={chromeIcon}
                                alt="Chromium"
                                className="w-5 h-5"
                            />
                            <CardTitle className="text-sm font-medium">{label}</CardTitle>
                        </div>
                        <Badge
                            variant={badgeVariant}
                            className="text-xs px-2 py-0.5 gap-1">
                            <BadgeIcon className="w-3 h-3" />
                        </Badge>
                    </CardHeader>

                    <CardContent className="pt-2 space-y-2">
                        {/* Configuration summary badges */}
                        {isLaunch && configSummary.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {configSummary.map((item, idx) => {
                                    const Icon = item.icon
                                    return (
                                        <Tooltip key={idx}>
                                            <TooltipTrigger asChild>
                                                <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                                                    <Icon className="w-3 h-3" />
                                                    <span>{item.value}</span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{item.label}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                })}
                                {hasCustomConfig && configSummary.length >= 3 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
                                                +{Object.keys(data.config.launch).length - 3} more
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Additional configuration options set</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        )}

                        {/* Description text */}
                        <div className="text-xs text-muted-foreground wrap-break-words pt-1">{details}</div>

                        {/* Additional info for close action */}
                        {isClose && <div className="text-xs text-muted-foreground/70 italic">Closes all pages and browser context</div>}
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    )
}

export default BrowserSessionAction
