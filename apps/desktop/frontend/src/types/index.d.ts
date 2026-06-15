import type * as neutralino from '@neutralinojs/lib'

type TNeutralino = typeof neutralino
declare global {
    interface Window {
        platform: TNeutralino
    }
}

export {}
