import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export function moduleDir(metaUrl: string) {
    return dirname(fileURLToPath(metaUrl))
}
