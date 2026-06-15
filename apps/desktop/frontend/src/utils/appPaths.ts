import { platform } from './platform'

export async function getUserDataDir() {
    let userDataPath = ''
    try {
        if (window.NL_OS === 'Windows') {
            userDataPath = await platform.os.getEnv('APPDATA')
        } else if (window.NL_OS === 'Darwin') {
            const home = await platform.os.getEnv('HOME')
            userDataPath = home + '/Library/Preferences'
        } else {
            const home = await platform.os.getEnv('HOME')
            userDataPath = home + '/.local/share'
        }
        console.log('User Data Dir:', userDataPath)
        return userDataPath
    } catch (err) {
        console.error('Error getting environment variable', err)
    }
}

export async function checkPathExists(path: string) {
    try {
        await platform.filesystem.getStats(path)
        return true
    } catch {
        return false
    }
}

export const getAppPath = async () => {
    return platform.filesystem.getAbsolutePath(window.NL_PATH)
}
