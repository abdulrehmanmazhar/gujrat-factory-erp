export default {
    NAME: 'Gujrat Factory ERP',
    API_BASE: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
    /** HTTP origin of the API server, e.g. http://localhost:8080 */
    SERVER_URL: (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '')
}
