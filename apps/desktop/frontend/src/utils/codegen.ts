import { checkPathExists } from './appPaths'
import { getChromeUserDataPath } from './chrome'
import { platform } from './platform'
import { getStorageSettings } from './storage'

export const runCodegen = async (id: string) => {
    const tempPath = await platform.os.getPath('temp')

    const targetFolder = `${tempPath}/${id}`

    if (!(await checkPathExists(targetFolder))) {
        await platform.filesystem.createDirectory(targetFolder)
    }

    const playwrightPath = await platform.filesystem.getAbsolutePath(`${window.NL_PATH}/playwright/cli.js`)
    const nodePath = await platform.filesystem.getAbsolutePath(`${window.NL_PATH}/node/node.exe`)

    const wrapPath = (path: string) => `"${path}"`

    const settings = await getStorageSettings()

    const isPersistentSession = settings?.sessionType === 'persistent'

    const chromeDataPath = settings?.persistencePath

    if (chromeDataPath && chromeDataPath === (await getChromeUserDataPath())) {
        throw new Error('You cannot use the Default chrome directory for automation or recording')
    }

    const userDataArg = isPersistentSession && chromeDataPath ? `--user-data-dir=${wrapPath(chromeDataPath)}` : ''

    const process = await platform.os.spawnProcess(
        `${wrapPath(nodePath)} ${wrapPath(playwrightPath)} codegen --target=jsonl -o actions.jsonl --channel=chrome --save-har=network_log.har ${userDataArg}`,
        {
            cwd: targetFolder
        }
    )

    return process
}

export const killCodegen = async (pid: number) => {
    let cmd

    if (window.NL_OS === 'Windows') {
        // cmd = `taskkill /PID ${pid} /T /F`
        cmd = `taskkill /PID ${pid} /T`
    } else {
        cmd = `kill -9 -${pid}`
    }

    console.log({ os: window.NL_OS, cmd })
    await platform.os.execCommand(cmd)
}

export const killProcess = async (pid: number) => {
    let cmd

    if (window.NL_OS === 'Windows') {
        cmd = `taskkill /PID ${pid} /T /F`
        // cmd = `taskkill /PID ${pid} /T`
    } else {
        cmd = `kill -9 -${pid}`
    }

    await platform.os.execCommand(cmd)
}
