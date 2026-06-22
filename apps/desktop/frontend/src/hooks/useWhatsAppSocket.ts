import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getSocketServerUrl } from '@/lib/socket'

export type WhatsAppQueueItem = {
    id: string
    contact: string
    kind: string
    status: string
    attempts: number
    lastError?: string | null
    createdAt?: string
    updatedAt?: string
}

export type WhatsAppQueueStats = {
    counts: {
        pending: number
        processing: number
        sent: number
        failed: number
        total: number
    }
    recent: WhatsAppQueueItem[]
}

let socket: Socket | null = null

function getSocket() {
    if (!socket) {
        socket = io(getSocketServerUrl(), {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            withCredentials: true
        })
    }
    return socket
}

export function useWhatsAppSocket() {
    const [qrCode, setQrCode] = useState('')
    const [connected, setConnected] = useState(false)
    const [socketReady, setSocketReady] = useState(false)
    const [socketError, setSocketError] = useState('')
    const [queueStats, setQueueStats] = useState<WhatsAppQueueStats | null>(null)

    useEffect(() => {
        const client = getSocket()

        const onConnect = () => {
            setSocketReady(true)
            setSocketError('')
        }
        const onQr = (qr: string) => {
            setQrCode(qr)
            setConnected(false)
            setSocketError('')
        }
        const onConnected = () => {
            setConnected(true)
            setQrCode('')
            setSocketError('')
        }
        const onDisconnected = () => {
            setConnected(false)
            setQrCode('')
        }
        const onStatus = (payload: { connected?: boolean }) => {
            setConnected(!!payload?.connected)
        }
        const onQueueUpdate = (stats: WhatsAppQueueStats) => {
            setQueueStats(stats)
        }
        const onConnectError = () => {
            setSocketReady(false)
            setSocketError(`Cannot reach server at ${getSocketServerUrl() || window.location.origin}. Is it running?`)
        }

        client.on('connect', onConnect)
        client.on('qr', onQr)
        client.on('whatsapp:connected', onConnected)
        client.on('whatsapp:disconnected', onDisconnected)
        client.on('whatsapp:status', onStatus)
        client.on('whatsapp:queue:update', onQueueUpdate)
        client.on('connect_error', onConnectError)

        if (!client.connected) client.connect()
        else setSocketReady(true)

        return () => {
            client.off('connect', onConnect)
            client.off('qr', onQr)
            client.off('whatsapp:connected', onConnected)
            client.off('whatsapp:disconnected', onDisconnected)
            client.off('whatsapp:status', onStatus)
            client.off('whatsapp:queue:update', onQueueUpdate)
            client.off('connect_error', onConnectError)
        }
    }, [])

    return {
        qrCode,
        connected,
        socketReady,
        socketError,
        queueStats
    }
}
