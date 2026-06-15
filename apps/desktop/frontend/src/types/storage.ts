export type TWorkflow = {
    id: string
    name: string
    thumbnail: string
    description: string
    createdAt: string
}[]

export type TWorkflowGraph = {
    nodes: {
        id: string
        data: unknown
        position: {
            x: number
            y: number
        }
        type: string
    }[]
    edges: {
        id: string
        source: string
        target: string
        type: string
    }[]
}

export type TSettings = {
    sessionType: 'persistent' | 'temporary'
    persistencePath?: string
}
