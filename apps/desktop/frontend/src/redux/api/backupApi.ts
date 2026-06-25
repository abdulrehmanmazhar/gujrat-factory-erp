import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope } from '@/types/api'

export interface RestoreBackupResponse {
    requiresRestart: boolean
    stagedAt: string
}

export const backupApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        restoreBackup: builder.mutation<RestoreBackupResponse, File>({
            query: (file) => {
                const body = new FormData()
                body.append('backup', file)
                return { url: '/backup/restore', method: 'POST', body }
            },
            transformResponse: (response: ApiEnvelope<RestoreBackupResponse>) => unwrapData(response)
        })
    })
})

export const { useRestoreBackupMutation } = backupApi

export async function downloadBackupFile(getToken: () => string | null) {
    const constants = await import('@/constants/app')
    const token = getToken()

    const response = await fetch(`${constants.default.API_BASE}/backup`, {
        method: 'GET',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })

    if (!response.ok) {
        let message = 'Backup download failed'
        try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) message = payload.message
        } catch {
            /* ignore */
        }
        throw new Error(message)
    }

    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const fileName = match?.[1] ?? `gujrat-factory-erp-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)

    return fileName
}
