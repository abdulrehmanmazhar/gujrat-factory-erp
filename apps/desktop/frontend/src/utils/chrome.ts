import { platform } from './platform'

type ChromeProfile = {
    directory: string
    name: string
}

export async function getChromeUserDataPath(): Promise<string> {
    const envs = await platform.os.getEnvs()

    let home: string

    switch (window.NL_OS) {
        case 'Windows':
            home = envs.USERPROFILE || `${envs.HOMEDRIVE}${envs.HOMEPATH}`
            return `${home}\\AppData\\Local\\Google\\Chrome\\User Data`

        case 'Darwin':
            home = envs.HOME
            return `${home}/Library/Application Support/Google/Chrome`

        default: // Linux
            home = envs.HOME
            return `${home}/.config/google-chrome`
    }
}

async function readLocalState(userDataPath: string): Promise<{ profile: { info_cache: unknown } } | null> {
    try {
        const path = `${userDataPath}/Local State`
        const content = await platform.filesystem.readFile(path)
        return JSON.parse(content)
    } catch (err) {
        console.error('Failed to read Local State:', err)
        return null
    }
}

export async function getChromeProfiles(): Promise<ChromeProfile[]> {
    const userDataPath = await getChromeUserDataPath()
    const localState = await readLocalState(userDataPath)

    console.log({ localState, userDataPath }) // Debugging output

    if (!localState?.profile?.info_cache) return []

    const profiles = localState.profile.info_cache

    return Object.entries(profiles).map(([dir, info]: [string, unknown]) => ({
        directory: dir,
        name: typeof info === 'object' && info !== null && 'name' in info ? (info as { name: string }).name : dir
    }))
}

type ChromeProcess = {
    ppid: number
    command: string
    pid: number
}

function parseProcessesDetailed(output: string): ChromeProcess[] {
    const lines = output.trim().split('\n')

    if (window.NL_OS === 'Windows') {
        // Skip header line(s)
        return lines
            .slice(1)
            .map((line) => {
                const parts = line.split(',')

                return {
                    command: parts[1]?.trim() || '',
                    ppid: Number(parts[2]),
                    pid: Number(parts[3])
                }
            })
            .filter((p) => !isNaN(p.pid))
    } else {
        return lines
            .map((line) => {
                const parts = line.trim().split(/\s+/)

                return {
                    pid: Number(parts[0]),
                    ppid: Number(parts[1]),
                    command: parts.slice(2).join(' ')
                }
            })
            .filter((p) => !isNaN(p.pid))
    }
}

export async function getChromeProcessesDetailed(): Promise<ChromeProcess[]> {
    try {
        let command = ''

        if (window.NL_OS === 'Windows') {
            command = `wmic process where "name='chrome.exe'" get ProcessId,ParentProcessId,CommandLine /FORMAT:CSV`
        } else {
            // safer grep (avoids matching itself)
            command = `ps -A -o pid=,ppid=,args= | grep -i "[c]hrome"`
        }

        const result = await platform.os.execCommand(command)

        if (!result.stdOut) return []

        return parseProcessesDetailed(result.stdOut)
    } catch (err) {
        console.error('Failed to get Chrome processes:', err)
        return []
    }
}

export async function getRootChromeProcesses() {
    const processes = await getChromeProcessesDetailed()

    return processes.filter((p) => {
        // Root Chrome process usually DOES NOT have --type=
        return !p.command.includes('--type=')
    })
}
