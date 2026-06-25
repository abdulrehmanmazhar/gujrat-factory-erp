import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { appConfig } from '../config/env.js'
import { logger } from '../config/logger.js'
import {
    copyDirectoryContents,
    getDatabaseFilePath,
    getDatabaseShmPath,
    getDatabaseWalPath,
    getRestorePendingPath,
    getRestoreStagingDir,
    removePathIfExists
} from '../utils/dataPaths.js'
import { getDataDir, getStorageRoot, resetRcloneSettings } from '../utils/rcloneSetup.js'

const BACKUP_FORMAT_VERSION = 1
const BACKUP_APP_ID = 'gujrat-factory-erp'

type BackupManifest = {
    version: number
    app: string
    createdAt: string
    databaseEntry: string
    storageEntry: string
}

type RestorePending = {
    databaseFile: string
    storageDir: string
    requestedAt: string
}

function formatBackupFileName(date = new Date()) {
    const stamp = date.toISOString().replace(/[:.]/g, '-')
    return `gujrat-factory-erp-${stamp}.bak`
}

async function checkpointDatabase() {
    const { getClient } = await import('../utils/db.js')
    try {
        await getClient().execute('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch (error) {
        logger.info('Database WAL checkpoint skipped', { meta: { error } })
    }
}

function addDirectoryToZip(zip: AdmZip, localDir: string, zipDir: string) {
    if (!fs.existsSync(localDir)) return
    zip.addLocalFolder(localDir, zipDir)
}

function readManifest(zip: AdmZip): BackupManifest {
    const entry = zip.getEntry('manifest.json')
    if (!entry) throw new Error('Invalid backup file: manifest.json is missing')

    let manifest: BackupManifest
    try {
        manifest = JSON.parse(zip.readAsText(entry)) as BackupManifest
    } catch {
        throw new Error('Invalid backup file: manifest.json is malformed')
    }

    if (manifest.app !== BACKUP_APP_ID) {
        throw new Error('Invalid backup file: this backup was created by another application')
    }

    if (!manifest.databaseEntry || !manifest.storageEntry) {
        throw new Error('Invalid backup file: manifest is incomplete')
    }

    return manifest
}

export async function createBackupArchive(): Promise<{ buffer: Buffer; fileName: string }> {
    const dataDir = getDataDir()
    const databasePath = getDatabaseFilePath()
    const storageRoot = getStorageRoot()

    if (!fs.existsSync(databasePath)) {
        throw new Error('Database file was not found')
    }

    await checkpointDatabase()

    const zip = new AdmZip()
    const databaseEntry = `database/${path.basename(databasePath)}`
    const storageEntry = 'rclone-storage'

    const manifest: BackupManifest = {
        version: BACKUP_FORMAT_VERSION,
        app: BACKUP_APP_ID,
        createdAt: new Date().toISOString(),
        databaseEntry,
        storageEntry
    }

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
    zip.addLocalFile(databasePath, 'database')

    if (fs.existsSync(storageRoot)) {
        addDirectoryToZip(zip, storageRoot, storageEntry)
    }

    const rcloneConfig = path.join(dataDir, 'rclone.conf')
    if (fs.existsSync(rcloneConfig)) {
        zip.addLocalFile(rcloneConfig, 'config')
    }

    return {
        buffer: zip.toBuffer(),
        fileName: formatBackupFileName()
    }
}

export async function stageRestoreArchive(backupFilePath: string) {
    if (!fs.existsSync(backupFilePath)) {
        throw new Error('Backup file was not found')
    }

    const zip = new AdmZip(backupFilePath)
    const manifest = readManifest(zip)

    const dataDir = getDataDir()
    const stagingDir = getRestoreStagingDir(dataDir)
    removePathIfExists(stagingDir)
    fs.mkdirSync(stagingDir, { recursive: true })

    zip.extractAllTo(stagingDir, true)

    const databaseFile = path.join(stagingDir, manifest.databaseEntry)
    const storageDir = path.join(stagingDir, manifest.storageEntry)

    if (!fs.existsSync(databaseFile) || !fs.statSync(databaseFile).isFile()) {
        removePathIfExists(stagingDir)
        throw new Error('Invalid backup file: database entry is missing')
    }

    if (!fs.existsSync(storageDir) || !fs.statSync(storageDir).isDirectory()) {
        removePathIfExists(stagingDir)
        throw new Error('Invalid backup file: storage entry is missing')
    }

    const pending: RestorePending = {
        databaseFile,
        storageDir,
        requestedAt: new Date().toISOString()
    }

    fs.writeFileSync(getRestorePendingPath(dataDir), JSON.stringify(pending, null, 2), 'utf8')

    return {
        requiresRestart: true,
        stagedAt: pending.requestedAt
    }
}

export async function applyPendingRestoreIfNeeded() {
    const dataDir = getDataDir()
    const pendingPath = getRestorePendingPath(dataDir)

    if (!fs.existsSync(pendingPath)) return false

    let pending: RestorePending
    try {
        pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as RestorePending
    } catch (error) {
        logger.error('Failed to read pending restore file', { meta: { error } })
        removePathIfExists(pendingPath)
        return false
    }

    const databaseTarget = getDatabaseFilePath()
    const storageTarget = getStorageRoot()

    if (!fs.existsSync(pending.databaseFile) || !fs.existsSync(pending.storageDir)) {
        logger.error('Pending restore staging files are missing', { meta: { pending } })
        removePathIfExists(pendingPath)
        removePathIfExists(getRestoreStagingDir(dataDir))
        return false
    }

    removePathIfExists(getDatabaseWalPath())
    removePathIfExists(getDatabaseShmPath())

    try {
        removePathIfExists(databaseTarget)
    } catch (error) {
        logger.error('Could not remove existing database file before restore', { meta: { error, databaseTarget } })
        throw new Error('Database file is locked. Close all running server instances and try again.')
    }

    fs.copyFileSync(pending.databaseFile, databaseTarget)

    removePathIfExists(storageTarget)
    fs.mkdirSync(storageTarget, { recursive: true })
    copyDirectoryContents(pending.storageDir, storageTarget)

    const stagedConfig = path.join(getRestoreStagingDir(dataDir), 'config', 'rclone.conf')
    if (fs.existsSync(stagedConfig)) {
        fs.copyFileSync(stagedConfig, path.join(dataDir, 'rclone.conf'))
    }

    removePathIfExists(pendingPath)
    removePathIfExists(getRestoreStagingDir(dataDir))

    resetRcloneSettings()

    logger.info('Pending backup restore applied', { meta: { databaseTarget, storageTarget } })
    return true
}

export function createRestoreUploadDir() {
    const dir = path.join(getDataDir(), 'restore-uploads')
    fs.mkdirSync(dir, { recursive: true })
    return dir
}

export function createTempRestorePath() {
    return path.join(os.tmpdir(), `erp-restore-${Date.now()}.bak`)
}
