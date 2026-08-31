import { Button } from '@/components/ui/button'
import { FileSpreadsheet } from 'lucide-react'

type BalanceSheetDownloadButtonProps = {
    loading?: boolean
    onClick: () => void
}

export function BalanceSheetDownloadButton({ loading, onClick }: BalanceSheetDownloadButtonProps) {
    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={onClick}>
            <FileSpreadsheet className="size-3.5" />
            Balance sheet
        </Button>
    )
}
