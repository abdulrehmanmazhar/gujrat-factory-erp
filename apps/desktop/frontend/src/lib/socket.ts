import constants from '@/constants/app'

/** Socket.io server origin. Uses VITE_SERVER_URL when set, otherwise same origin (Vite proxy). */
export function getSocketServerUrl() {
    return constants.SERVER_URL || undefined
}
