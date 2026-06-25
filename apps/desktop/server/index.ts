import 'dotenv/config'
import { applyPendingRestoreIfNeeded } from './services/backup.service.js'
import { initializeRclone } from './utils/rcloneSetup.js'
import { logger } from './config/logger.js'

async function main() {
    const restored = await applyPendingRestoreIfNeeded()
    if (restored) {
        logger.info('Database and file storage were restored from a pending backup')
    }

    initializeRclone()

    const { startServer } = await import('./startServer.js')
    await startServer()
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
