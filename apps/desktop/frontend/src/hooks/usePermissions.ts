import { useSelector } from 'react-redux'
import { canDelete, canWrite, isAdminOrAbove, isReadOnlyUser, isSuperAdmin } from '@/lib/roles'
import { selectCurrentUser } from '@/redux/slices/authSlice'

export function usePermissions() {
    const role = useSelector(selectCurrentUser)?.role

    return {
        role,
        canWrite: canWrite(role),
        canDelete: canDelete(role),
        isReadOnly: isReadOnlyUser(role),
        isAdmin: isAdminOrAbove(role) && !isSuperAdmin(role),
        isSuperAdmin: isSuperAdmin(role)
    }
}
