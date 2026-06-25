import fs from 'node:fs'
import path from 'node:path'
import type { Request } from 'express'
import { appConfig } from '../config/env.js'
import { logger } from '../config/logger.js'
import { moduleDir } from './esm.js'

const LOCAL_REMOTE_NAME = 'erpstorage'

export type RcloneSettings = {
    remote: string
    basePath: string
    configPath: string
    storageRoot: string
    mode: 'local' | 'cloud'
}

let settings: RcloneSettings | null = null

export function getDataDir() {
    const dbUrl = appConfig.DATABASE_URL
    const filePath = dbUrl.replace(/^file:/, '')
    if (filePath && filePath !== ':memory:') {
        return path.dirname(path.resolve(filePath))
    }
    return path.resolve(process.cwd(), 'data')
}

function writeLocalRcloneConfig(configPath: string, storageRoot: string) {
    const aliasPath = storageRoot.replace(/\\/g, '/')
    const contents = `[${LOCAL_REMOTE_NAME}]
type = alias
remote = ${aliasPath}
`
    fs.writeFileSync(configPath, contents, 'utf8')
}

export function resetRcloneSettings() {
    settings = null
}

export function initializeRclone(): RcloneSettings {
    if (settings) return settings

    const dataDir = getDataDir()
    const storageRoot = path.join(dataDir, 'rclone-storage')
    fs.mkdirSync(storageRoot, { recursive: true })

    const basePath = (process.env.RCLONE_BASE_PATH || appConfig.RCLONE_BASE_PATH || 'gujrat-factory-erp').replace(/^\/+|\/+$/g, '')
    const envRemote = process.env.RCLONE_REMOTE?.trim() || appConfig.RCLONE_REMOTE?.trim()
    const envConfig = process.env.RCLONE_CONFIG?.trim() || appConfig.RCLONE_CONFIG?.trim()

    const useBundledLocal = !envRemote || envRemote === LOCAL_REMOTE_NAME || envRemote.startsWith(`${LOCAL_REMOTE_NAME}:`)

    if (useBundledLocal) {
        const configPath = path.join(dataDir, 'rclone.conf')
        writeLocalRcloneConfig(configPath, storageRoot)
        settings = {
            remote: LOCAL_REMOTE_NAME,
            basePath,
            configPath,
            storageRoot,
            mode: 'local'
        }
        logger.info('Rclone initialized with bundled local storage', {
            meta: { storageRoot, configPath, remote: LOCAL_REMOTE_NAME }
        })
        return settings
    }

    settings = {
        remote: envRemote.replace(/:$/, ''),
        basePath,
        configPath: envConfig || '',
        storageRoot,
        mode: 'cloud'
    }
    logger.info('Rclone initialized with custom remote', { meta: { remote: settings.remote, configPath: settings.configPath || 'default' } })
    return settings
}

export function getRcloneSettings() {
    return initializeRclone()
}

export function isRcloneConfigured() {
    initializeRclone()
    return true
}

export function getStorageRoot() {
    return getRcloneSettings().storageRoot
}

export function resolveStoredFilePath(relativeUrlPath: string) {
    const normalized = relativeUrlPath.replace(/^\/+/, '').replace(/\\/g, '/')
    const abs = path.resolve(getStorageRoot(), normalized)
    const root = path.resolve(getStorageRoot())

    if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) {
        throw new Error('Invalid file path')
    }

    return abs
}

export function getFileServeUrl(relativePath: string, req?: Request) {
    const filePath = [getRcloneSettings().basePath, relativePath.replace(/^\/+/, '')].filter(Boolean).join('/').replace(/\\/g, '/')

    if (req) {
        return `${req.protocol}://${req.get('host')}/api/v1/files/${filePath}`
    }

    const base = appConfig.PUBLIC_URL || `http://127.0.0.1:${appConfig.PORT}`
    return `${base}/api/v1/files/${filePath}`
}
