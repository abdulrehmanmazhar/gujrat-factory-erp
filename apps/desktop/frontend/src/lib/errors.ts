export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong') {
    if (err && typeof err === 'object' && 'data' in err) {
        const data = (err as { data?: { message?: string } }).data
        if (data?.message) return data.message
    }
    return fallback
}
