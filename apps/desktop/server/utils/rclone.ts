import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Request } from 'express'
import { logger } from '../config/logger.js'
import { moduleDir } from './esm.js'
import { getFileServeUrl, getRcloneSettings, initializeRclone, isRcloneConfigured } from './rcloneSetup.js'

const SERVER_ROOT = path.join(moduleDir(import.meta.url), '..')
const RCLONE_BIN = path.join(SERVER_ROOT, 'rclone', process.platform === 'win32' ? 'rclone.exe' : 'rclone')

export { getFileServeUrl, getStorageRoot, initializeRclone, isRcloneConfigured, resolveStoredFilePath } from './rcloneSetup.js'

function getRemoteRoot() {
    const { remote, basePath } = getRcloneSettings()
    return basePath ? `${remote}:${basePath}` : `${remote}:`
}

export function toRemotePath(relativePath: string) {
    const rel = relativePath.replace(/^\/+/, '')
    const root = getRemoteRoot().replace(/:$/, '')
    return `${root}/${rel}`
}

function rcloneArgs(args: string[]) {
    const { configPath } = getRcloneSettings()
    return configPath ? ['--config', configPath, ...args] : args
}

function runRclone(args: string[]): Promise<string> {
    initializeRclone()

    return new Promise((resolve, reject) => {
        if (!fs.existsSync(RCLONE_BIN)) {
            reject(new Error(`rclone binary not found at ${RCLONE_BIN}`))
            return
        }

        const proc = spawn(RCLONE_BIN, rcloneArgs(args), { windowsHide: true })
        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8')
        })
        proc.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8')
        })
        proc.on('error', reject)
        proc.on('close', (code) => {
            if (code === 0) resolve(stdout.trim())
            else reject(new Error(stderr.trim() || `rclone exited with code ${code}`))
        })
    })
}

function runRcloneBinary(args: string[]): Promise<Buffer> {
    initializeRclone()

    return new Promise((resolve, reject) => {
        if (!fs.existsSync(RCLONE_BIN)) {
            reject(new Error(`rclone binary not found at ${RCLONE_BIN}`))
            return
        }

        const proc = spawn(RCLONE_BIN, rcloneArgs(args), { windowsHide: true })
        const chunks: Buffer[] = []
        let stderr = ''

        proc.stdout.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
        })
        proc.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8')
        })
        proc.on('error', reject)
        proc.on('close', (code) => {
            if (code === 0) resolve(Buffer.concat(chunks))
            else reject(new Error(stderr.trim() || `rclone exited with code ${code}`))
        })
    })
}

async function tryPublicLink(remotePath: string) {
    try {
        return await runRclone(['link', remotePath])
    } catch (error) {
        logger.info('rclone link failed', { meta: { remotePath, error } })
        return null
    }
}

function resolvePublicUrl(relativePath: string, remotePath: string, req?: Request) {
    const { mode } = getRcloneSettings()
    if (mode === 'local') return getFileServeUrl(relativePath, req)
    return null
}

export async function uploadBuffer(buffer: Buffer, relativePath: string, req?: Request) {
    const remotePath = toRemotePath(relativePath)
    const tmp = path.join(os.tmpdir(), `rclone-${Date.now()}-${path.basename(relativePath)}`)

    try {
        fs.writeFileSync(tmp, buffer)
        await runRclone(['copyto', tmp, remotePath])
        const localUrl = resolvePublicUrl(relativePath, remotePath, req)
        const url = localUrl ?? (await tryPublicLink(remotePath)) ?? getFileServeUrl(relativePath, req)
        return { remotePath, url }
    } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
    }
}

export async function uploadFile(localPath: string, relativePath: string, req?: Request) {
    const remotePath = toRemotePath(relativePath)
    await runRclone(['copyto', localPath, remotePath])
    const localUrl = resolvePublicUrl(relativePath, remotePath, req)
    const url = localUrl ?? (await tryPublicLink(remotePath)) ?? getFileServeUrl(relativePath, req)
    return { remotePath, url }
}

export async function downloadBuffer(remotePath: string) {
    return runRcloneBinary(['cat', remotePath])
}

export async function downloadText(remotePath: string) {
    const buffer = await downloadBuffer(remotePath)
    return buffer.toString('utf8')
}

export async function deleteRemoteFile(remotePath: string) {
    try {
        await runRclone(['deletefile', remotePath])
    } catch (error) {
        logger.info('rclone deletefile failed', { meta: { remotePath, error } })
    }
}
