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
