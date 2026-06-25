import fs from 'node:fs'
import path from 'node:path'
import { appConfig } from '../config/env.js'

export function getDatabaseFilePath() {
    const dbUrl = appConfig.DATABASE_URL
    const filePath = dbUrl.replace(/^file:/, '')
    if (!filePath || filePath === ':memory:') {
        throw new Error('Backup is not supported for in-memory databases')
    }
    return path.resolve(filePath)
}

export function getDatabaseWalPath() {
    return `${getDatabaseFilePath()}-wal`
}

export function getDatabaseShmPath() {
    return `${getDatabaseFilePath()}-shm`
}

export function getRestorePendingPath(dataDir: string) {
    return path.join(dataDir, '.restore-pending.json')
}

export function getRestoreStagingDir(dataDir: string) {
    return path.join(dataDir, 'restore-staging')
}

export function removePathIfExists(target: string) {
    if (!fs.existsSync(target)) return
    fs.rmSync(target, { recursive: true, force: true })
}

export function copyDirectoryContents(sourceDir: string, destinationDir: string) {
    fs.mkdirSync(destinationDir, { recursive: true })

    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        const from = path.join(sourceDir, entry.name)
        const to = path.join(destinationDir, entry.name)

        if (entry.isDirectory()) {
            copyDirectoryContents(from, to)
        } else if (entry.isFile()) {
            fs.mkdirSync(path.dirname(to), { recursive: true })
            fs.copyFileSync(from, to)
        }
    }
}
