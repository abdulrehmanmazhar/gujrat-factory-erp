import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ExpenditurePaymentMode } from '@/types/api'
import { ImagePlus, X } from 'lucide-react'

export type PaymentProofValue = {
    paymentMode: ExpenditurePaymentMode
    proofImage: File | null
}

export function usePaymentProofFields(open: boolean) {
    const [paymentMode, setPaymentMode] = useState<ExpenditurePaymentMode>('cash')
    const [proofImage, setProofImage] = useState<File | null>(null)

    useEffect(() => {
        if (!open) return
        setPaymentMode('cash')
        setProofImage(null)
    }, [open])

    return {
        paymentMode,
        setPaymentMode,
        proofImage,
        setProofImage,
        value: { paymentMode, proofImage } satisfies PaymentProofValue
    }
}

export function PaymentProofFields({
    paymentMode,
    onPaymentModeChange,
    proofImage,
    onProofImageChange,
    showWhen = true,
    modeLabel = 'Payment mode'
}: {
    paymentMode: ExpenditurePaymentMode
    onPaymentModeChange: (mode: ExpenditurePaymentMode) => void
    proofImage: File | null
    onProofImageChange: (file: File | null) => void
    showWhen?: boolean
    modeLabel?: string
}) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!proofImage) {
            setPreviewUrl(null)
            return
        }
        const url = URL.createObjectURL(proofImage)
        setPreviewUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [proofImage])

    if (!showWhen) return null

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label>{modeLabel}</Label>
                <Select
                    value={paymentMode}
                    onValueChange={(value) => onPaymentModeChange(value as ExpenditurePaymentMode)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Payment proof (optional)</Label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onProofImageChange(e.target.files?.[0] ?? null)}
                />
                {previewUrl ? (
                    <div className="relative overflow-hidden rounded-md border">
                        <img
                            src={previewUrl}
                            alt="Proof preview"
                            className="max-h-40 w-full object-cover"
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute right-2 top-2 size-7"
                            onClick={() => {
                                onProofImageChange(null)
                                if (fileInputRef.current) fileInputRef.current.value = ''
                            }}>
                            <X className="size-4" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => fileInputRef.current?.click()}>
                        <ImagePlus className="mr-2 size-4" />
                        Upload receipt or proof
                    </Button>
                )}
            </div>
        </div>
    )
}

export function appendPaymentProof(formData: FormData, value: PaymentProofValue) {
    formData.append('paymentMode', value.paymentMode)
    if (value.proofImage) formData.append('proofImage', value.proofImage)
}
