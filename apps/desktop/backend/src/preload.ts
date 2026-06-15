import * as Neutralino from '@neutralinojs/lib'
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
            }
        }
    }

    Neutralino.init()
    window.platform = createPlatform()
})()
