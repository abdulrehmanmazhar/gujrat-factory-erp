import constants from '@/constants/app'
import { DEFAULT_POS_BANNER_HEIGHT, useGetSettingsQuery } from '@/redux/api/settingsApi'

export function OrderEntryHeader() {
    const { data } = useGetSettingsQuery()
    const settings = data?.settings
    const bannerUrl = settings?.posBannerUrl
    const height = settings?.posBannerHeightPx ?? DEFAULT_POS_BANNER_HEIGHT

    return (
        <div className="-mx-6 pb-2">
            {bannerUrl ? (
                <img
                    src={bannerUrl}
                    alt={`${constants.NAME} banner`}
                    style={{ height }}
                    className="block w-full object-fill"
                />
            ) : (
                <div
                    style={{ height }}
                    className="text-muted-foreground flex w-full items-center justify-center border border-dashed bg-muted/30 px-4 text-center text-sm">
                    POS banner not configured — upload one in Settings
                </div>
            )}
        </div>
    )
}
