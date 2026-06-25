import { QRCodeSVG } from 'qrcode.react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import constants from '@/constants/app'
import { useWhatsAppSocket } from '@/hooks/useWhatsAppSocket'
import { MessageCircle } from 'lucide-react'

export function WhatsAppSetupGate({ children }: { children: React.ReactNode }) {
    const { qrCode, connected, socketReady, socketError } = useWhatsAppSocket()

    if (connected) return <>{children}</>

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="size-5" />
                            <div>
                                <CardTitle>Connect WhatsApp</CardTitle>
                                <CardDescription>Required before using {constants.NAME}</CardDescription>
                            </div>
                        </div>
                        <Badge variant="secondary">{qrCode ? 'Scan QR' : socketReady ? 'Waiting' : 'Connecting'}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 py-4">
                    {socketError ? (
                        <p className="text-center text-sm text-destructive">{socketError}</p>
                    ) : qrCode ? (
                        <>
                            <QRCodeSVG
                                value={qrCode}
                                size={280}
                                level="M"
                                includeMargin
                            />
                            <p className="text-center text-sm text-muted-foreground">
                                Open WhatsApp on your phone → Linked devices → Link a device, then scan this code. Sign-up codes and customer messages
                                are sent through this connection.
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">{socketReady ? 'Waiting for QR code…' : 'Connecting to server…'}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
