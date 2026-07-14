export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    USER: 'User'
} as const

export function normalizeRole(role?: string | null) {
    return role?.toLowerCase() ?? ''
}

export function isSuperAdmin(role?: string | null) {
    return normalizeRole(role) === ROLES.SUPER_ADMIN
}

export function isAdminOrAbove(role?: string | null) {
    const normalized = normalizeRole(role)
    return normalized === ROLES.ADMIN || normalized === ROLES.SUPER_ADMIN
}

export function canWrite(role?: string | null) {
    return isAdminOrAbove(role)
}

export function canDelete(role?: string | null) {
    return isSuperAdmin(role)
}

export function isReadOnlyUser(role?: string | null) {
    return normalizeRole(role) === ROLES.USER.toLowerCase()
}

export function roleCanAccess(required: string, userRole?: string | null) {
    const allowed = required.toLowerCase()
    const normalized = normalizeRole(userRole)
    if (!normalized) return false
    if (normalized === allowed) return true
    if (normalized === ROLES.SUPER_ADMIN && allowed === ROLES.ADMIN) return true
    return false
}
