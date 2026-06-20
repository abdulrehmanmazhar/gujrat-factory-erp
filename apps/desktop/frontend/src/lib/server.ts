import app from '@/constants/app'

const DEFAULT_PORT = 8080
const HEALTH_CHECK_PATH = '/test'
const DEFAULT_PROBE_TIMEOUT_MS = 4_000

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
        'os' in window.platform &&
        typeof window.platform.os?.spawnProcess === 'function' &&
        'filesystem' in window.platform &&
        typeof window.platform.filesystem?.getAbsolutePath === 'function'
    )
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

function attachSpawnLogs(processId: number) {
    const handler = (event: SpawnedProcessEvent) => {
        if (event.detail.id !== processId) return

        switch (event.detail.action) {
            case 'stdOut':
                console.log(`[server] ${event.detail.data}`)
                break
            case 'stdErr':
                console.error(`[server] ${event.detail.data}`)
                break
            case 'exit':
                console.error(`[server] process exited with code ${event.detail.data}`)
                window.platform.events.off('spawnedProcess', handler)
                break
        }
    }

    window.platform.events.on('spawnedProcess', handler)
}

export const runServer = async (): Promise<SpawnedProcess> => {
    if (!canSpawnServer()) {
        throw new Error('Server startup is only available in the desktop runtime')
    }

    const platform = window.platform

    const nodePath = normalizePath(await platform.filesystem.getAbsolutePath(`${window.NL_PATH}/node/node.exe`))
    const serverPath = normalizePath(await platform.filesystem.getAbsolutePath(`${window.NL_PATH}/server/index.js`))
    const serverDir = dirname(serverPath)

    const command = `${quoteCmdArg(nodePath)} ${quoteCmdArg(serverPath)}`

    console.log('Spawning server process', { command, cwd: serverDir })

    const process = await platform.os.spawnProcess(command, {
        cwd: serverDir
    })

    attachSpawnLogs(process.id)

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

export const ensureServerReady = async (port = getServerPort(), onStatus?: (message: string) => void): Promise<void> => {
    onStatus?.('Checking server connection...')

    if (await listenPort(port)) {
        onStatus?.('Server ready')
        return
    }

    if (canSpawnServer()) {
        onStatus?.('Starting server...')
        await runServer()
    } else {
        onStatus?.(`Waiting for server on port ${port}...`)
    }

    await waitForPort(port, {
        onPoll: () => onStatus?.(`Waiting for server on port ${port}...`)
    })

    onStatus?.('Server ready')
}
