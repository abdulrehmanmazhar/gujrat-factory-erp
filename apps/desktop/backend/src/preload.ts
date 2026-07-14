import * as Neutralino from '@neutralinojs/lib'

type SpawnedProcessRef = {
    id: number
    pid: number
}

declare global {
    interface Window {
        __erpSpawnedServer?: SpawnedProcessRef | null
        __erpIntentionalShutdown?: boolean
    }
}

;(function () {
    function createPlatform() {
        if (window.NL_PORT) {
            return {
                type: 'neutralino',

                app: Neutralino.app,

                os: Neutralino.os,

                events: Neutralino.events,

                storage: Neutralino.storage,

                filesystem: Neutralino.filesystem
            }
        }

        // fallback (web / dev)
        return {
            type: 'web',

            app: {
                exit: async () => {
                    console.log('exit')
                }
            },

            os: {
                showMessage: async (msg: unknown) => {
                    console.log('DEV:', msg)
                }
            },

            events: {
                on: () => undefined,
                off: () => undefined
            },

            storage: {
                getData: async () => '',
                setData: async () => undefined,
                removeData: async () => undefined
            }
        }
    }

    async function stopSpawnedServer() {
        const proc = window.__erpSpawnedServer
        if (!proc) return

        window.__erpSpawnedServer = null
        try {
            await Neutralino.os.updateSpawnedProcess(proc.id, 'exit')
        } catch (error) {
            console.warn('Failed to stop server process on window close', error)
        }
    }

    Neutralino.init()
    window.platform = createPlatform()

    if (window.NL_PORT) {
        Neutralino.events.on('windowClose', () => {
            window.__erpIntentionalShutdown = true
            void stopSpawnedServer().finally(() => {
                void Neutralino.app.exit()
            })
        })
    }
})()
