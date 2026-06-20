import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { QRCodeSVG } from 'qrcode.react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSocketServerUrl } from '@/lib/socket'

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

export function WhatsAppQrCard() {
    const [qrCode, setQrCode] = useState('')
    const [connected, setConnected] = useState(false)
    const [socketReady, setSocketReady] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const client = getSocket()

        const onConnect = () => {
            setSocketReady(true)
            setError('')
        }
        const onQr = (qr: string) => {
            setQrCode(qr)
            setConnected(false)
            setError('')
        }
        const onConnected = () => {
            setConnected(true)
            setQrCode('')
            setError('')
        }
        const onDisconnected = () => {
            setConnected(false)
        }
        const onStatus = (payload: { connected?: boolean }) => {
            setConnected(!!payload?.connected)
        }
        const onConnectError = (err: Error) => {
            setSocketReady(false)
            setError(`Cannot reach server at ${getSocketServerUrl() || window.location.origin}. Is it running?`)
            console.error('Socket connect error:', err.message)
        }

        client.on('connect', onConnect)
        client.on('qr', onQr)
        client.on('whatsapp:connected', onConnected)
        client.on('whatsapp:disconnected', onDisconnected)
        client.on('whatsapp:status', onStatus)
        client.on('connect_error', onConnectError)

        if (!client.connected) client.connect()
        else setSocketReady(true)

        return () => {
            client.off('connect', onConnect)
            client.off('qr', onQr)
            client.off('whatsapp:connected', onConnected)
            client.off('whatsapp:disconnected', onDisconnected)
            client.off('whatsapp:status', onStatus)
            client.off('connect_error', onConnectError)
        }
    }, [])

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <CardTitle>WhatsApp</CardTitle>
                        <CardDescription>Scan the QR code to link WhatsApp for order receipts</CardDescription>
                    </div>
                    <Badge variant={connected ? 'default' : 'secondary'}>
                        {connected ? 'Connected' : socketReady ? 'Waiting for QR' : 'Disconnected'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 py-6">
                {error ? (
                    <p className="max-w-sm text-center text-sm text-destructive">{error}</p>
                ) : connected ? (
                    <p className="text-sm text-muted-foreground">WhatsApp is connected and ready to send receipts.</p>
                ) : qrCode ? (
                    <>
                        <QRCodeSVG
                            value={qrCode}
                            size={256}
                            level="M"
                            includeMargin
                        />
                        <p className="max-w-sm text-center text-sm text-muted-foreground">
                            Open WhatsApp on your phone → Linked devices → Link a device, then scan this code.
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">{socketReady ? 'Waiting for QR code from server...' : 'Connecting to server...'}</p>
                )}
            </CardContent>
        </Card>
    )
}
