import React from 'react'
import { cn } from '@/lib/utils'

type HeaderProps = {
    title: string
    subtitle: string
    actions?: React.ReactNode
    className?: string
}

function Header({ title, subtitle, actions }: HeaderProps) {
    return (
        // <header className={cn('flex items-center justify-between gap-4 border-b px-6 py-4', className)}>
        //     {/* Left */}
        //     <div className="min-w-0">
        //         {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
        //         {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        //     </div>

        //     {/* Right */}
        //     {actions && <div className="flex items-center gap-2">{actions}</div>}
        // </header>

        <div className={cn('sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-16')}>
            <div className="flex h-full items-center justify-between px-6">
                <div className="flex flex-col justify-center">
                    <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                    <p className="text-muted-foreground text-sm">{subtitle}</p>
                </div>

                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
        </div>
    )
}

export default Header
