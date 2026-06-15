import constants from '@/constants/app'
import { cn } from '@/lib/utils'

type Props = {
    className?: string
}

function Footer({ className }: Props) {
    return (
        <footer className={cn('py-2 text-center text-[11px] text-muted-foreground/80', className)}>
            {constants.APP_WARNING} ·{' '}
            <span className="font-medium tracking-wide">
                <a
                    href={constants.DEVELOPER_WEBSITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline">
                    {constants.DEVELOPER_BRANDING}
                </a>
            </span>
        </footer>
    )
}

export default Footer
