export const SERVER_READY_PREFIX = 'ERP_SERVER_READY:'
export const RESTORE_COMPLETED_SIGNAL = 'ERP_RESTORE_COMPLETED'

export function emitServerReady(port: number) {
    process.stdout.write(`${SERVER_READY_PREFIX}${JSON.stringify({ port })}\n`)
}

export function emitRestoreCompleted() {
    process.stdout.write(`${RESTORE_COMPLETED_SIGNAL}\n`)
}
