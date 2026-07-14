export function normalizeRole(role?: string | null) {
    return role?.toLowerCase() ?? ''
}

export function isSuperAdmin(role?: string | null) {
    return normalizeRole(role) === 'super_admin'
}

export function isAdminOrAbove(role?: string | null) {
    const normalized = normalizeRole(role)
    return normalized === 'admin' || normalized === 'super_admin'
}

export function canWrite(role?: string | null) {
    return isAdminOrAbove(role)
}

export function canDelete(role?: string | null) {
    return isSuperAdmin(role)
}

export function isReadOnlyUser(role?: string | null) {
    return normalizeRole(role) === 'user'
}
