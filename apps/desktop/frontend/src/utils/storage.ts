import { StorageModels } from '@/constants/storage'
import { platform } from './platform'
import type { TSettings, TWorkflow, TWorkflowGraph } from '@/types/storage'

export const getCollections = async () => {
    try {
        const allCollections = await platform.storage.getKeys()
        return allCollections
    } catch {
        return []
    }
}
export const getStorageWorkflow = async () => {
    const allCollections = await getCollections()
    if (!allCollections.some((str) => str === StorageModels['workflows'])) return []
    const stringified = await platform.storage.getData(StorageModels['workflows'])
    return JSON.parse(stringified) as TWorkflow
}

export const setStorageWorkflows = async (workflows: TWorkflow) => {
    const stringified = JSON.stringify(workflows)
    await platform.storage.setData(StorageModels['workflows'], stringified)
}

export const getWorkflowGraphById = async (id: string) => {
    const allCollections = await getCollections()

    if (!allCollections.some((str) => str === id)) return null

    const stringified = await platform.storage.getData(id)
    return JSON.parse(stringified) as TWorkflowGraph
}

export const setWorkflowGraph = async (id: string, workflowGraph: TWorkflowGraph) => {
    await platform.storage.setData(id, JSON.stringify(workflowGraph))
}

export const getStorageSettings = async () => {
    const allCollections = await getCollections()
    if (!allCollections.some((str) => str === StorageModels['settings'])) return null
    const stringified = await platform.storage.getData(StorageModels['settings'])
    return JSON.parse(stringified) as TSettings
}
export const setStorageSettings = async (settings: TSettings) => {
    const stringified = JSON.stringify(settings)
    await platform.storage.setData(StorageModels['settings'], stringified)
}
