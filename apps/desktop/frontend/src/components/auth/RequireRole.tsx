import { usePermissions } from '@/hooks/usePermissions'
import { Navigate } from 'react-router-dom'

export function RequireWrite({ children }: { children: React.ReactNode }) {
    const { canWrite } = usePermissions()

    if (!canWrite) {
        return (
            <Navigate
                to="/"
                replace
            />
        )
    }

    return children
}

export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
    const { isSuperAdmin } = usePermissions()

    if (!isSuperAdmin) {
        return (
            <Navigate
                to="/"
                replace
            />
        )
    }

    return children
}
