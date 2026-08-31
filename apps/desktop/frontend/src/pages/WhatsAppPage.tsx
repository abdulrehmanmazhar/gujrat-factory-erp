import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PaginationControls, totalPages } from '@/components/shared/PaginationControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWhatsAppSocket } from '@/hooks/useWhatsAppSocket'
import { usePermissions } from '@/hooks/usePermissions'
import { getApiErrorMessage } from '@/lib/errors'
import {
    useGetWhatsAppQueueQuery,
    useGetWhatsAppStatusQuery,
    useLogoutWhatsAppMutation,
    useRetryFailedWhatsAppQueueMutation,
    useRetryWhatsAppQueueItemMutation,
    type WhatsAppQueueStatusFilter
} from '@/redux/api/whatsappApi'
import { Loader2, LogOut, MessageCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 20

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
    const { qrCode, connected, socketReady, socketError, queueStats } = useWhatsAppSocket()
    const { data: apiStatus, refetch: refetchStatus, isFetching: fetchingStatus } = useGetWhatsAppStatusQuery()
    const [logoutWhatsApp, { isLoading: loggingOut }] = useLogoutWhatsAppMutation()
    const [retryItem, { isLoading: retryingItem }] = useRetryWhatsAppQueueItemMutation()
    const [retryFailed, { isLoading: retryingFailed }] = useRetryFailedWhatsAppQueueMutation()

    const [statusFilter, setStatusFilter] = useState<WhatsAppQueueStatusFilter>('all')
    const [page, setPage] = useState(1)
    const [retryingId, setRetryingId] = useState<string | null>(null)

    const {
        data: queuePage,
        refetch: refetchQueue,
        isFetching: fetchingQueue,
        isLoading: loadingQueue
    } = useGetWhatsAppQueueQuery({ status: statusFilter, page, limit: PAGE_SIZE })

    const liveCounts = queueStats?.counts ?? queuePage?.counts ?? apiStatus?.counts
    const items = queuePage?.items ?? []
    const total = queuePage?.total ?? 0
    const pages = totalPages(total, PAGE_SIZE)
    const { canWrite } = usePermissions()

    useEffect(() => {
        setPage(1)
    }, [statusFilter])

    useEffect(() => {
        if (queueStats) void refetchQueue()
    }, [queueStats, refetchQueue])

    const handleLogout = async () => {
        try {
            await logoutWhatsApp().unwrap()
            toast.success('WhatsApp logged out. Scan the new QR code to link again.')
            void refetchStatus()
            void refetchQueue()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Logout failed'))
        }
    }

    const handleRetryItem = async (id: string) => {
        setRetryingId(id)
        try {
            await retryItem(id).unwrap()
            toast.success('Message queued for retry')
            void refetchQueue()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Retry failed'))
        } finally {
            setRetryingId(null)
        }
    }

    const handleRetryFailed = async () => {
        try {
            const result = await retryFailed().unwrap()
            toast.success(result.retried ? `Queued ${result.retried} failed message(s)` : 'No failed messages to retry')
            void refetchQueue()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Retry failed'))
        }
    }

    const refreshing = fetchingStatus || fetchingQueue

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
                            onClick={() => {
                                void refetchStatus()
                                void refetchQueue()
                            }}
                            disabled={refreshing}>
                            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {canWrite && connected ? (
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
                                {canWrite ? (
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
                        {liveCounts ? (
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{liveCounts.pending}</p>
                                        <p className="text-xs text-muted-foreground">Pending</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{liveCounts.processing}</p>
                                        <p className="text-xs text-muted-foreground">Processing</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{liveCounts.sent}</p>
                                        <p className="text-xs text-muted-foreground">Sent</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-2xl font-semibold">{liveCounts.failed}</p>
                                        <p className="text-xs text-muted-foreground">Failed</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Total queued items: {liveCounts.total}. Counts update live via WebSocket.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Loading queue stats…</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Queue activity</CardTitle>
                        <CardDescription>Filter by status, paginate, and retry failed sends</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value as WhatsAppQueueStatusFilter)}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                            </SelectContent>
                        </Select>
                        {canWrite && (liveCounts?.failed ?? 0) > 0 ? (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={retryingFailed}
                                onClick={() => void handleRetryFailed()}>
                                {retryingFailed ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RotateCcw className="mr-2 size-4" />}
                                Retry all failed
                            </Button>
                        ) : null}
                        <PaginationControls
                            page={page}
                            totalPages={pages}
                            onPrev={() => setPage((value) => Math.max(1, value - 1))}
                            onNext={() => setPage((value) => Math.min(pages, value + 1))}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingQueue ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">Loading queue…</p>
                    ) : items.length ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Attempts</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead>Error</TableHead>
                                    {canWrite ? <TableHead className="w-[100px]">Actions</TableHead> : null}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
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
                                        {canWrite ? (
                                            <TableCell>
                                                {item.status === 'failed' || item.status === 'processing' ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={retryingItem && retryingId === item.id}
                                                        onClick={() => void handleRetryItem(item.id)}>
                                                        {retryingItem && retryingId === item.id ? (
                                                            <Loader2 className="size-4 animate-spin" />
                                                        ) : (
                                                            <RotateCcw className="size-4" />
                                                        )}
                                                    </Button>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                        ) : null}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">No queue items for this filter.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
