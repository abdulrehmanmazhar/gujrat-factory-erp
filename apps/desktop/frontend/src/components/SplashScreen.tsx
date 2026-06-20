import logo from '@/assets/logo.png'
import app from '@/constants/app'

type SplashScreenProps = {
    status: string
    error?: boolean
}

export function SplashScreen({ status, error = false }: SplashScreenProps) {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-foreground">
            <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
                <img
                    src={logo}
                    alt={`${app.NAME} logo`}
                    className="h-28 w-28 object-contain"
                />
                <div className="space-y-3">
                    <h1 className="text-2xl font-semibold tracking-tight">{app.NAME}</h1>
                    <p className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{status}</p>
                </div>
                {!error ? (
                    <div
                        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
                        aria-hidden
                    />
                ) : null}
            </div>
        </div>
    )
}
