import { QRCodeSVG } from 'qrcode.react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWhatsAppSocket } from '@/hooks/useWhatsAppSocket'
import { isAdminOrAbove } from '@/lib/roles'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetWhatsAppStatusQuery, useLogoutWhatsAppMutation } from '@/redux/api/whatsappApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import { Loader2, LogOut, MessageCircle, RefreshCw } from 'lucide-react'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'

function statusLabel(connected: boolean, socketReady: boolean, qrCode: string) {
    if (connected) return 'Connected'
    if (qrCode) return 'Scan QR to connect'
    if (socketReady) return 'Waiting for QR'
    return 'Connecting…'
}

function queueStatusBadge(status: string) {
    if (status === 'sent') return 'default'
    if (status === 'failed') return 'destructive'
    if (status === 'processing') return 'secondary'
    return 'outline'
}

export default function WhatsAppPage() {
    const user = useSelector(selectCurrentUser)
    const { qrCode, connected, socketReady, socketError, queueStats } = useWhatsAppSocket()
    const { data: apiStatus, refetch, isFetching } = useGetWhatsAppStatusQuery()
    const [logoutWhatsApp, { isLoading: loggingOut }] = useLogoutWhatsAppMutation()

    const stats = queueStats ?? (apiStatus ? { counts: apiStatus.counts, recent: apiStatus.recent } : null)
    const canLogout = isAdminOrAbove(user?.role)

    const handleLogout = async () => {
        try {
            await logoutWhatsApp().unwrap()
            toast.success('WhatsApp logged out. Scan the new QR code to link again.')
            refetch()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Logout failed'))
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="WhatsApp"
                description="Link WhatsApp for invoices and receipts. Queue progress updates in real time."
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isFetching}>
                            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {canLogout && connected ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleLogout}
                                disabled={loggingOut}>
                                {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                                Log out
                            </Button>
                        ) : null}
                    </div>
                }
            />

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="size-5" />
                                <div>
                                    <CardTitle>Connection</CardTitle>
                                    <CardDescription>Scan QR with WhatsApp → Linked devices</CardDescription>
                                </div>
                            </div>
                            <Badge variant={connected ? 'default' : 'secondary'}>{statusLabel(connected, socketReady, qrCode)}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4 py-6">
                        {socketError ? (
                            <p className="max-w-sm text-center text-sm text-destructive">{socketError}</p>
                        ) : connected ? (
                            <div className="space-y-2 text-center">
                                <p className="text-sm text-muted-foreground">
                                    WhatsApp is connected. Invoices and receipts are sent through the persistent queue.
                                </p>
                                {canLogout ? (
                                    <p className="text-xs text-muted-foreground">Use Log out above to unlink this device and show a new QR code.</p>
                                ) : null}
                            </div>
                        ) : qrCode ? (
                            <>
                                <QRCodeSVG
                                    value={qrCode}
                                    size={280}
                                    level="M"
                                    includeMargin
                                />
                                <p className="max-w-sm text-center text-sm text-muted-foreground">
                                    Open WhatsApp on your phone → Linked devices → Link a device, then scan this code.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {socketReady ? 'Waiting for QR code from server…' : 'Connecting to server…'}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Send queue</CardTitle>
                        <CardDescription>Messages persist across restarts and retry automatically</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {stats ? (
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{stats.counts.pending}</p>
                                        <p className="text-xs text-muted-foreground">Pending</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{stats.counts.processing}</p>
                                        <p className="text-xs text-muted-foreground">Processing</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{stats.counts.sent}</p>
                                        <p className="text-xs text-muted-foreground">Sent</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{stats.counts.failed}</p>
                                        <p className="text-xs text-muted-foreground">Failed</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Total queued items: {stats.counts.total}. Updates live via WebSocket when messages are enqueued or delivered.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Loading queue stats…</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent queue activity</CardTitle>
                    <CardDescription>Latest messages in the outbound WhatsApp queue</CardDescription>
                </CardHeader>
                <CardContent>
                    {stats?.recent?.length ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Attempts</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead>Error</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.recent.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.contact}</TableCell>
                                        <TableCell className="capitalize">{item.kind}</TableCell>
                                        <TableCell>
                                            <Badge variant={queueStatusBadge(item.status)}>{item.status}</Badge>
                                        </TableCell>
                                        <TableCell>{item.attempts ?? 0}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-xs text-destructive">{item.lastError ?? '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">No queue items yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
