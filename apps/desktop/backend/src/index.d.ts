import type * as neutralino from '@neutralinojs/lib'

declare global {
    interface Window {
        Neutralino: neutralino
        platform: unknown
    }
}

export {}
