import app from '@/constants/app'

const DEFAULT_PORT = 8080
const HEALTH_CHECK_PATH = '/test'
const DEFAULT_PROBE_TIMEOUT_MS = 4_000
const SERVER_READY_PREFIX = 'ERP_SERVER_READY:'
const RESTORE_COMPLETED_SIGNAL = 'ERP_RESTORE_COMPLETED'
const STARTUP_TIMEOUT_MS = 120_000

type WaitForPortOptions = {
    intervalMs?: number
    timeoutMs?: number
    onPoll?: () => void
}

type SpawnedProcessEvent = CustomEvent<{
    id: number
    action: 'stdOut' | 'stdErr' | 'exit'
    data: string | number
}>

type SpawnedProcess = {
    id: number
    pid: number
}

declare global {
    interface Window {
        __erpSpawnedServer?: SpawnedProcess | null
        __erpIntentionalShutdown?: boolean
    }
}

type ServerStartupSignal = { type: 'ready'; port: number } | { type: 'restore_completed' } | { type: 'exit'; code: number }

let spawnedServerProcess: SpawnedProcess | null = null
let intentionalShutdown = false
let lifecycleRegistered = false
let crashWatcherProcessId: number | null = null
let serverReadyPromise: Promise<void> | null = null
let spawnServerPromise: Promise<SpawnedProcess> | null = null
const statusListeners = new Set<(message: string) => void>()

function notifyStatus(message: string) {
    statusListeners.forEach((listener) => listener(message))
}

export function getServerPort(): number {
    if (!app.SERVER_URL) return DEFAULT_PORT

    try {
        const url = new URL(app.SERVER_URL)
        if (url.port) return Number(url.port)
        return url.protocol === 'https:' ? 443 : 80
    } catch {
        return DEFAULT_PORT
    }
}

/** Candidate origins — try both localhost and 127.0.0.1 to avoid IPv6 mismatch on Windows. */
export function getServerOrigins(port = getServerPort()): string[] {
    const origins = new Set<string>()

    if (app.SERVER_URL) {
        try {
            const url = new URL(app.SERVER_URL)
            origins.add(url.origin)

            const portSuffix = url.port ? `:${url.port}` : ''
            if (url.hostname === 'localhost') {
                origins.add(`${url.protocol}//127.0.0.1${portSuffix}`)
            } else if (url.hostname === '127.0.0.1') {
                origins.add(`${url.protocol}//localhost${portSuffix}`)
            }
        } catch {
            // fall through
        }
    }

    if (origins.size === 0) {
        origins.add(`http://127.0.0.1:${port}`)
        origins.add(`http://localhost:${port}`)
    }

    return [...origins]
}

function getProbeUrls(port = getServerPort()): string[] {
    const urls = new Set<string>()

    if (import.meta.env.DEV && typeof window !== 'undefined') {
        urls.add(`${window.location.origin}${HEALTH_CHECK_PATH}`)
    }

    for (const origin of getServerOrigins(port)) {
        urls.add(`${origin}${HEALTH_CHECK_PATH}`)
    }

    return [...urls]
}

function cacheBust(url: string) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}_=${Date.now()}`
}

async function probeFetch(url: string, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS): Promise<boolean> {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(cacheBust(url), {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
            credentials: 'omit'
        })
        return response.ok
    } catch {
        return false
    } finally {
        window.clearTimeout(timer)
    }
}

export async function listenPort(port = getServerPort()): Promise<boolean> {
    const urls = getProbeUrls(port)

    const probes = urls.map((url) =>
        probeFetch(url).then((ok) => {
            if (ok) return true
            throw new Error(`unreachable: ${url}`)
        })
    )

    try {
        await Promise.any(probes)
        return true
    } catch {
        return false
    }
}

function canSpawnServer(): boolean {
    return Boolean(
        window.NL_PATH &&
        window.platform &&
        window.platform.type === 'neutralino' &&
        typeof window.platform.os.spawnProcess === 'function' &&
        typeof window.platform.filesystem.getAbsolutePath === 'function'
    )
}

function getDesktopPlatform() {
    if (!canSpawnServer()) return null
    return window.platform
}

function normalizePath(path: string) {
    return path.replace(/\\/g, '/')
}

function dirname(filePath: string) {
    return normalizePath(filePath).replace(/\/[^/]+$/, '')
}

/** Quote only when needed — Neutralino wraps the full command in cmd.exe /c "..." on Windows. */
function quoteCmdArg(value: string) {
    return value.includes(' ') ? `"${value}"` : value
}

function parseStdoutLine(line: string): ServerStartupSignal | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    if (trimmed.startsWith(SERVER_READY_PREFIX)) {
        try {
            const payload = JSON.parse(trimmed.slice(SERVER_READY_PREFIX.length)) as { port?: number }
            if (typeof payload.port === 'number') {
                return { type: 'ready', port: payload.port }
            }
        } catch {
            return null
        }
    }

    if (trimmed.includes(RESTORE_COMPLETED_SIGNAL)) {
        return { type: 'restore_completed' }
    }

    return null
}

function waitForSpawnSignal(processId: number, timeoutMs = STARTUP_TIMEOUT_MS): Promise<ServerStartupSignal> {
    return new Promise((resolve, reject) => {
        let stdoutBuffer = ''
        const timeout = window.setTimeout(() => {
            cleanup()
            reject(new Error('Server did not report ready via stdout in time'))
        }, timeoutMs)

        const handler = (event: SpawnedProcessEvent) => {
            if (event.detail.id !== processId) return

            switch (event.detail.action) {
                case 'stdOut': {
                    stdoutBuffer += String(event.detail.data)
                    const lines = stdoutBuffer.split(/\r?\n/)
                    stdoutBuffer = lines.pop() ?? ''

                    for (const line of lines) {
                        const signal = parseStdoutLine(line)
                        if (signal) {
                            cleanup()
                            resolve(signal)
                            return
                        }
                    }
                    break
                }
                case 'stdErr':
                    console.error(`[server] ${event.detail.data}`)
                    break
                case 'exit': {
                    const pending = parseStdoutLine(stdoutBuffer)
                    if (pending) {
                        cleanup()
                        resolve(pending)
                        return
                    }
                    cleanup()
                    resolve({ type: 'exit', code: Number(event.detail.data) })
                    break
                }
            }
        }

        const cleanup = () => {
            window.clearTimeout(timeout)
            window.platform.events.off('spawnedProcess', handler)
        }

        window.platform.events.on('spawnedProcess', handler)
    })
}

function rememberSpawnedServer(process: SpawnedProcess) {
    spawnedServerProcess = process
    window.__erpSpawnedServer = process
}

function forgetSpawnedServer() {
    spawnedServerProcess = null
    window.__erpSpawnedServer = null
}

function getTrackedSpawnedServer(): SpawnedProcess | null {
    return spawnedServerProcess ?? window.__erpSpawnedServer ?? null
}

function attachServerProcessWatcher(processId: number) {
    if (crashWatcherProcessId === processId) return
    crashWatcherProcessId = processId

    const handler = (event: SpawnedProcessEvent) => {
        if (event.detail.id !== processId) return

        if (event.detail.action === 'stdOut') {
            console.log(`[server] ${event.detail.data}`)
            return
        }

        if (event.detail.action === 'stdErr') {
            console.error(`[server] ${event.detail.data}`)
            return
        }

        if (event.detail.action === 'exit') {
            window.platform.events.off('spawnedProcess', handler)
            crashWatcherProcessId = null
            forgetSpawnedServer()
            console.error(`[server] process exited with code ${event.detail.data}`)

            if (!intentionalShutdown && !window.__erpIntentionalShutdown) {
                console.error('[desktop] server process ended unexpectedly — closing application')
                void suicideDesktopApp()
            }
        }
    }

    window.platform.events.on('spawnedProcess', handler)
}

export async function stopServerProcess(): Promise<void> {
    const processRef = getTrackedSpawnedServer()
    if (!processRef) return

    const platform = getDesktopPlatform()
    forgetSpawnedServer()
    intentionalShutdown = true
    window.__erpIntentionalShutdown = true

    try {
        if (platform) {
            await platform.os.updateSpawnedProcess(processRef.id, 'exit')
        }
    } catch (error) {
        console.warn('Failed to stop server process cleanly', error)
    }
}

/** Terminates the API server and exits the Neutralino desktop shell. */
export async function suicideDesktopApp(): Promise<void> {
    intentionalShutdown = true
    await stopServerProcess()

    try {
        await window.platform.app.exit()
    } catch (error) {
        console.warn('Failed to exit desktop application', error)
    }
}

/** Close the app after staging a backup restore so the next launch can apply it. */
export async function restartAppForPendingRestore(): Promise<void> {
    await suicideDesktopApp()
}

function registerDesktopLifecycle() {
    if (lifecycleRegistered || !canSpawnServer()) return
    lifecycleRegistered = true

    // Preload registers windowClose in dev; keep this for production builds without preload.
    window.platform.events.on('windowClose', () => {
        intentionalShutdown = true
        window.__erpIntentionalShutdown = true
        void stopServerProcess().finally(() => {
            void window.platform.app.exit()
        })
    })
}

export const runServer = async (): Promise<SpawnedProcess> => {
    const existing = getTrackedSpawnedServer()
    if (existing) return existing

    if (spawnServerPromise) return spawnServerPromise

    spawnServerPromise = runServerInternal().finally(() => {
        spawnServerPromise = null
    })

    return spawnServerPromise
}

async function runServerInternal(): Promise<SpawnedProcess> {
    const platform = getDesktopPlatform()
    if (!platform) {
        throw new Error('Server startup is only available in the desktop runtime')
    }

    const nodePath = normalizePath(await platform.filesystem.getAbsolutePath(`${window.NL_PATH}/node/node.exe`))
    const serverPath = normalizePath(await platform.filesystem.getAbsolutePath(`${window.NL_PATH}/server/index.js`))
    const serverDir = dirname(serverPath)

    const command = `${quoteCmdArg(nodePath)} ${quoteCmdArg(serverPath)}`

    console.log('Spawning server process', { command, cwd: serverDir })

    intentionalShutdown = false
    const process = await platform.os.spawnProcess(command, {
        cwd: serverDir
    })

    rememberSpawnedServer(process)
    return process
}

export const waitForPort = async (port: number, options: WaitForPortOptions = {}): Promise<void> => {
    const { intervalMs = 500, timeoutMs = 60_000, onPoll } = options
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        onPoll?.()

        if (await listenPort(port)) {
            return
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Server did not respond on port ${port}. Make sure the API server is running.`)
}

async function ensureServerReadyInternal(port = getServerPort()): Promise<void> {
    notifyStatus('Checking server connection...')

    if (canSpawnServer()) {
        if (await listenPort(port)) {
            notifyStatus('Server ready')
            return
        }

        if (getTrackedSpawnedServer()) {
            notifyStatus('Waiting for server startup signal...')
            await waitForPort(port, {
                timeoutMs: STARTUP_TIMEOUT_MS,
                onPoll: () => notifyStatus('Waiting for server startup signal...')
            })
            const tracked = getTrackedSpawnedServer()
            if (tracked) attachServerProcessWatcher(tracked.id)
            notifyStatus('Server ready')
            return
        }

        notifyStatus('Starting server...')
        const process = await runServer()

        notifyStatus('Waiting for server startup signal...')
        const signal = await waitForSpawnSignal(process.id)

        if (signal.type === 'restore_completed') {
            notifyStatus('Backup restored. Closing application — reopen to continue.')
            await suicideDesktopApp()
            return
        }

        if (signal.type === 'exit') {
            throw new Error(`Server exited during startup (code ${signal.code})`)
        }

        attachServerProcessWatcher(process.id)
        notifyStatus('Server ready')
        return
    }

    if (await listenPort(port)) {
        notifyStatus('Server ready')
        return
    }

    notifyStatus(`Waiting for server on port ${port}...`)
    await waitForPort(port, {
        onPoll: () => notifyStatus(`Waiting for server on port ${port}...`)
    })

    notifyStatus('Server ready')
}

export const ensureServerReady = (port = getServerPort(), onStatus?: (message: string) => void): Promise<void> => {
    registerDesktopLifecycle()

    if (onStatus) statusListeners.add(onStatus)

    if (!serverReadyPromise) {
        serverReadyPromise = ensureServerReadyInternal(port).catch((error) => {
            serverReadyPromise = null
            throw error
        })
    }

    return serverReadyPromise.finally(() => {
        if (onStatus) statusListeners.delete(onStatus)
    })
}
