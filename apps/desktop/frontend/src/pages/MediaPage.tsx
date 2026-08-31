import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { PageHeader } from '@/components/shared/PageHeader'
import { PaginationControls, totalPages } from '@/components/shared/PaginationControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadBlob } from '@/lib/download'
import { getApiErrorMessage } from '@/lib/errors'
import { fetchMediaBlob, useGetMediaQuery, type MediaKindFilter } from '@/redux/api/mediaApi'
import { selectAuthToken } from '@/redux/slices/authSlice'
import { Download, ExternalLink, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 20

function kindBadge(kind: string) {
    if (kind === 'invoice') return 'default'
    if (kind === 'receipt') return 'secondary'
    if (kind === 'proof') return 'outline'
    return 'outline'
}

export default function MediaPage() {
    const token = useSelector(selectAuthToken)
    const [q, setQ] = useState('')
    const [search, setSearch] = useState('')
    const [kind, setKind] = useState<MediaKindFilter>('all')
    const [page, setPage] = useState(1)
    const [busyId, setBusyId] = useState<string | null>(null)

    const { data, isLoading, isFetching, refetch } = useGetMediaQuery({
        q: search,
        kind,
        page,
        limit: PAGE_SIZE
    })

    const items = data?.items ?? []
    const total = data?.total ?? 0
    const pages = totalPages(total, PAGE_SIZE)

    useEffect(() => {
        setPage(1)
    }, [search, kind])

    const runSearch = () => {
        setSearch(q.trim())
    }

    const handleOpen = async (id: string) => {
        setBusyId(id)
        try {
            const { blob } = await fetchMediaBlob(id, () => token, 'inline')
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank', 'noopener,noreferrer')
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not open file'))
        } finally {
            setBusyId(null)
        }
    }

    const handleDownload = async (id: string) => {
        setBusyId(id)
        try {
            const { blob, fileName } = await fetchMediaBlob(id, () => token, 'attachment')
            downloadBlob(blob, fileName)
            toast.success('Download started')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not download file'))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Media"
                description="Search payment proofs and WhatsApp invoice/receipt documents by customer, contact, or order number."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void refetch()}
                        disabled={isFetching}>
                        {isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
                        Refresh
                    </Button>
                }
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Customer name, contact, or order number"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') runSearch()
                            }}
                        />
                    </div>
                    <Button
                        type="button"
                        onClick={runSearch}>
                        Search
                    </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={kind}
                        onValueChange={(value) => setKind(value as MediaKindFilter)}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Kind" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All media</SelectItem>
                            <SelectItem value="proof">Proofs</SelectItem>
                            <SelectItem value="invoice">Invoices</SelectItem>
                            <SelectItem value="receipt">Receipts</SelectItem>
                            <SelectItem value="document">WhatsApp docs</SelectItem>
                        </SelectContent>
                    </Select>
                    <PaginationControls
                        page={page}
                        totalPages={pages}
                        onPrev={() => setPage((value) => Math.max(1, value - 1))}
                        onNext={() => setPage((value) => Math.min(pages, value + 1))}
                    />
                </div>
            </div>

            {isLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Loading media…</p>
            ) : items.length ? (
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>File</TableHead>
                                <TableHead>Kind</TableHead>
                                <TableHead>Party</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Order #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="w-[140px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="max-w-[220px] truncate font-medium">{item.fileName}</TableCell>
                                    <TableCell>
                                        <Badge variant={kindBadge(item.kind)}>{item.kind}</Badge>
                                    </TableCell>
                                    <TableCell>{item.partyName ?? '—'}</TableCell>
                                    <TableCell>{item.contact ?? '—'}</TableCell>
                                    <TableCell>{item.orderNumber ?? '—'}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={busyId === item.id}
                                                onClick={() => void handleOpen(item.id)}>
                                                {busyId === item.id ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <ExternalLink className="size-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={busyId === item.id}
                                                onClick={() => void handleDownload(item.id)}>
                                                <Download className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">No media matched this search.</p>
            )}
        </div>
    )
}
