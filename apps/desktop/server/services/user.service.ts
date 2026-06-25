// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, customerTransactions, labourerTransactions, orders, restockOrders, supplierTransactions, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import {
    comparePassword,
    hashPassword,
    signAccessToken,
    signRefreshToken,
    signActivationToken,
    signResetToken,
    verifyActivationToken,
    verifyResetToken
} from '../utils/auth.js'
import { createId, mapUser, withLegacyId, withLegacyIds } from '../utils/mappers.js'
import { isSuperAdmin, ROLES } from '../utils/roles.js'
import { assertValidWhatsAppContact } from '../utils/phone.js'
import { isWhatsappConnected, sendMessage } from '../utils/whatsapp.js'

export async function findUserByContact(contact: string) {
    const normalized = assertValidWhatsAppContact(contact)
    const [user] = await db.select().from(users).where(eq(users.contact, normalized)).limit(1)
    return user ?? null
}

async function hasNoUsers() {
    const [existing] = await db.select({ id: users.id }).from(users).limit(1)
    return !existing
}

/** First registered user becomes the sole verified super admin. */
async function getBootstrapUserFields() {
    if (!(await hasNoUsers())) return {}
    return { isVerified: true, role: ROLES.SUPER_ADMIN }
}

function assertSuperAdmin(actorUserId: string, actor: Awaited<ReturnType<typeof findUserById>>) {
    if (!actor || actor.id !== actorUserId || !isSuperAdmin(actor.role)) {
        throw new AppError('Only super admin can perform this action', 403)
    }
}

async function assertUserHasNoRelations(userId: string) {
    const [customer, order, restock, customerTxn, supplierTxn, labourTxn] = await Promise.all([
        db.select({ id: customers.id }).from(customers).where(eq(customers.createdById, userId)).limit(1),
        db.select({ id: orders.id }).from(orders).where(eq(orders.createdById, userId)).limit(1),
        db.select({ id: restockOrders.id }).from(restockOrders).where(eq(restockOrders.createdById, userId)).limit(1),
        db.select({ id: customerTransactions.id }).from(customerTransactions).where(eq(customerTransactions.createdById, userId)).limit(1),
        db.select({ id: supplierTransactions.id }).from(supplierTransactions).where(eq(supplierTransactions.createdById, userId)).limit(1),
        db.select({ id: labourerTransactions.id }).from(labourerTransactions).where(eq(labourerTransactions.createdById, userId)).limit(1)
    ])

    if (customer.length || order.length || restock.length || customerTxn.length || supplierTxn.length || labourTxn.length) {
        throw new AppError('Cannot delete user with existing records in the system', 400)
    }
}

export async function findUserById(id: string, includePassword = false) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!user) return null
    if (!includePassword) {
        const { password: _, ...safeUser } = user
        return safeUser
    }
    return user
}

export async function getUserProfile(userId: string) {
    const user = await findUserById(userId)
    if (!user) return null
    return mapUser({ ...user, password: null })
}

async function sendAuthCodeToWhatsApp(contact: string, code: string, purpose: string) {
    if (!isWhatsappConnected()) {
        throw new AppError('WhatsApp is not connected. Scan the QR code on the setup screen first.', 503)
    }
    const normalized = assertValidWhatsAppContact(contact)
    await sendMessage(normalized, `Your ${purpose} code is ${code}. It expires shortly.`)
}

export async function registerUser(name: string, contact: string, password: string) {
    const normalized = assertValidWhatsAppContact(contact, 'WhatsApp number')
    const existing = await findUserByContact(normalized)
    if (existing) throw new AppError('An account already exists for this WhatsApp number', 400)

    const activationCode = Math.floor(1000 + Math.random() * 9000).toString()
    const token = signActivationToken({ user: { name, contact: normalized, password }, activationCode })

    await sendAuthCodeToWhatsApp(normalized, activationCode, 'account activation')

    return { activationToken: token }
}

export async function activateUser(activationToken: string, activationCode: string) {
    const decoded = verifyActivationToken<{ user: { name: string; contact: string; password: string }; activationCode: string }>(activationToken)
    if (decoded.activationCode !== activationCode) throw new AppError('Invalid activation code', 400)

    const existing = await findUserByContact(decoded.user.contact)
    if (existing) throw new AppError('WhatsApp number already registered', 400)

    const [user] = await db
        .insert(users)
        .values({
            id: createId(),
            name: decoded.user.name,
            contact: decoded.user.contact,
            password: await hashPassword(decoded.user.password),
            ...(await getBootstrapUserFields())
        })
        .returning()

    return mapUser(user)
}

export async function loginUser(contact: string, password: string) {
    const normalized = assertValidWhatsAppContact(contact, 'WhatsApp number')
    const [user] = await db.select().from(users).where(eq(users.contact, normalized)).limit(1)
    if (!user?.password) throw new AppError('Invalid WhatsApp number or password', 400)

    const valid = await comparePassword(password, user.password)
    if (!valid) throw new AppError('Invalid WhatsApp number or password', 400)
    if (!user.isVerified) throw new AppError('Cannot login without being verified by admin', 400)

    return {
        user: mapUser({ ...user, password: undefined }),
        accessToken: signAccessToken(user.id),
        refreshToken: signRefreshToken(user.id)
    }
}

export async function refreshAccessToken(userId: string) {
    const user = await findUserById(userId)
    if (!user) throw new AppError("Couldn't refresh token", 400)
    return { accessToken: signAccessToken(userId), refreshToken: signRefreshToken(userId), user: mapUser({ ...user, password: null }) }
}

export async function updateUserInfo(userId: string, name?: string, contact?: string) {
    const user = await findUserById(userId)
    if (!user) throw new AppError('User not found', 400)

    let normalizedContact: string | undefined
    if (contact && contact !== user.contact) {
        normalizedContact = assertValidWhatsAppContact(contact, 'WhatsApp number')
        const existing = await findUserByContact(normalizedContact)
        if (existing && existing.id !== userId) throw new AppError('WhatsApp number already in use', 400)
    }

    const [updated] = await db
        .update(users)
        .set({
            ...(name ? { name } : {}),
            ...(normalizedContact ? { contact: normalizedContact } : {}),
            updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning()

    return mapUser({ ...updated, password: null })
}

export async function updateUserPassword(userId: string, oldPassword: string, newPassword: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user?.password) throw new AppError('Invalid user', 400)

    const valid = await comparePassword(oldPassword, user.password)
    if (!valid) throw new AppError('Invalid password', 400)

    const [updated] = await db
        .update(users)
        .set({ password: await hashPassword(newPassword), updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning()

    return mapUser({ ...updated, password: null })
}

export async function updateUserAvatar(userId: string, avatarPublicId: string, avatarUrl: string) {
    const [updated] = await db.update(users).set({ avatarPublicId, avatarUrl, updatedAt: new Date() }).where(eq(users.id, userId)).returning()
    return mapUser({ ...updated, password: null })
}

export async function listUsers() {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt))
    return rows.map((user) => mapUser({ ...user, password: null }))
}

export async function updateUserRole(userId: string, role: string, actorUserId: string) {
    const actor = await findUserById(actorUserId)
    assertSuperAdmin(actorUserId, actor)

    const target = await findUserById(userId)
    if (!target) throw new AppError('User not found', 404)
    if (isSuperAdmin(target.role)) throw new AppError('Super admin role cannot be changed', 400)

    const normalized = role.toLowerCase()
    if (normalized === ROLES.SUPER_ADMIN) throw new AppError('Super admin role cannot be assigned', 400)
    if (normalized !== ROLES.ADMIN && normalized !== 'user') throw new AppError('Invalid role', 400)

    const nextRole = normalized === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER

    const [updated] = await db.update(users).set({ role: nextRole, updatedAt: new Date() }).where(eq(users.id, userId)).returning()
    if (!updated) throw new AppError('User not found', 404)
    return mapUser({ ...updated, password: null })
}

export async function deleteUser(userId: string, actorUserId: string) {
    if (userId === actorUserId) throw new AppError('You cannot delete your own account', 400)

    const actor = await findUserById(actorUserId)
    assertSuperAdmin(actorUserId, actor)

    const target = await findUserById(userId)
    if (!target) throw new AppError('User not found', 404)
    if (isSuperAdmin(target.role)) throw new AppError('Super admin account cannot be deleted', 400)

    await assertUserHasNoRelations(userId)

    const result = await db.delete(users).where(eq(users.id, userId)).returning()
    if (!result.length) throw new AppError('User not found', 404)
}

export async function addVerifiedUser(_name: string, _contact: string, _password: string) {
    throw new AppError('Manual user creation is disabled. Users must register through sign up.', 403)
}

export async function verifyUserById(userId: string, actorUserId: string) {
    const actor = await findUserById(actorUserId)
    assertSuperAdmin(actorUserId, actor)

    const target = await findUserById(userId)
    if (!target) throw new AppError('User Does not exist', 400)
    if (isSuperAdmin(target.role)) throw new AppError('Super admin is already verified', 400)

    const [updated] = await db.update(users).set({ isVerified: true, updatedAt: new Date() }).where(eq(users.id, userId)).returning()
    if (!updated) throw new AppError('User Does not exist', 400)
    return mapUser({ ...updated, password: null })
}

export async function requestPasswordReset(contact: string) {
    const normalized = assertValidWhatsAppContact(contact, 'WhatsApp number')
    const [user] = await db.select().from(users).where(eq(users.contact, normalized)).limit(1)
    if (!user?.password) {
        return { resetToken: null as string | null }
    }

    const resetCode = Math.floor(1000 + Math.random() * 9000).toString()
    const resetToken = signResetToken({ userId: user.id, contact: user.contact, resetCode })

    await sendAuthCodeToWhatsApp(user.contact, resetCode, 'password reset')

    return { resetToken }
}

export async function resetPassword(resetToken: string, resetCode: string, newPassword: string) {
    const decoded = verifyResetToken<{ userId: string; contact: string; resetCode: string }>(resetToken)
    if (decoded.resetCode !== resetCode) throw new AppError('Invalid reset code', 400)
    if (!newPassword || newPassword.length < 6) throw new AppError('Password must be at least 6 characters', 400)

    const [updated] = await db
        .update(users)
        .set({ password: await hashPassword(newPassword), updatedAt: new Date() })
        .where(eq(users.id, decoded.userId))
        .returning()

    if (!updated) throw new AppError('User not found', 404)
    return mapUser({ ...updated, password: null })
}
