import 'dotenv/config'
import { applyPendingRestoreIfNeeded } from './services/backup.service.js'
import { initializeRclone } from './utils/rcloneSetup.js'
import { logger } from './config/logger.js'
import { emitRestoreCompleted } from './utils/lifecycleSignals.js'

function registerProcessSafetyHandlers() {
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled promise rejection — process kept alive', {
            meta: {
                reason: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined
            }
        })
    })

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception — process kept alive', {
            meta: { error: error.message, stack: error.stack }
        })
    })
}

registerProcessSafetyHandlers()

async function main() {
    const restored = await applyPendingRestoreIfNeeded()
    if (restored) {
        logger.info('Database and file storage were restored from a pending backup')
        emitRestoreCompleted()
        process.exit(0)
        return
    }

    initializeRclone()

    const { startServer } = await import('./startServer.js')
    await startServer()
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
