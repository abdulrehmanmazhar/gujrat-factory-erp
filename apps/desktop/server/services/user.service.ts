// @ts-nocheck
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../utils/db.js'
import {
    customerOrders,
    customers,
    orderItems,
    orders,
    productSales,
    products,
    productStockHistory,
    targets,
    transactions,
    userRoutes,
    users
} from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { comparePassword, hashPassword, signAccessToken, signRefreshToken, signActivationToken, verifyActivationToken } from '../utils/auth.js'
import { createId, mapUser, withLegacyId, withLegacyIds } from '../utils/mappers.js'
import sendMail from '../utils/sendMail.js'

export async function findUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return user ?? null
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

export async function getUserRoutes(userId: string) {
    const routes = await db.select().from(userRoutes).where(eq(userRoutes.userId, userId)).orderBy(userRoutes.createdAt)
    return routes.map((r) => r.route)
}

export async function getUserWithRoutes(userId: string) {
    const user = await findUserById(userId)
    if (!user) return null
    const routes = await getUserRoutes(userId)
    return { ...mapUser({ ...user, password: null }), routes }
}

export async function registerUser(name: string, email: string, password: string) {
    const existing = await findUserByEmail(email)
    if (existing) throw new AppError('Email already exist', 400)

    const activationCode = Math.floor(1000 + Math.random() * 9000).toString()
    const token = signActivationToken({ user: { name, email, password }, activationCode })

    await sendMail({
        email,
        subject: 'Activate your account',
        template: 'activation-mail.ejs',
        data: { user: { name }, activationCode }
    })

    return { activationToken: token }
}

export async function activateUser(activationToken: string, activationCode: string) {
    const decoded = verifyActivationToken<{ user: { name: string; email: string; password: string }; activationCode: string }>(activationToken)
    if (decoded.activationCode !== activationCode) throw new AppError('Invalid activation code', 400)

    const existing = await findUserByEmail(decoded.user.email)
    if (existing) throw new AppError('email already exist', 400)

    const [user] = await db
        .insert(users)
        .values({
            id: createId(),
            name: decoded.user.name,
            email: decoded.user.email,
            password: await hashPassword(decoded.user.password)
        })
        .returning()

    return mapUser(user)
}

export async function loginUser(email: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user?.password) throw new AppError('Invalid email or password', 400)

    const valid = await comparePassword(password, user.password)
    if (!valid) throw new AppError('Invalid email or password', 400)
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

export async function createSocialUser(email: string, name: string, avatarUrl: string) {
    let user = await findUserByEmail(email)
    if (!user) {
        const [created] = await db
            .insert(users)
            .values({
                id: createId(),
                name,
                email,
                avatarUrl,
                isVerified: true
            })
            .returning()
        user = created
    }
    return {
        user: mapUser({ ...user, password: null }),
        accessToken: signAccessToken(user.id),
        refreshToken: signRefreshToken(user.id)
    }
}

export async function updateUserInfo(userId: string, name?: string, email?: string) {
    const user = await findUserById(userId)
    if (!user) throw new AppError('User not found', 400)

    if (email && email !== user.email) {
        const existing = await findUserByEmail(email)
        if (existing) throw new AppError('Email already exist', 400)
    }

    const [updated] = await db
        .update(users)
        .set({
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
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
    return Promise.all(
        rows.map(async (user) => {
            const routes = await getUserRoutes(user.id)
            return { ...mapUser({ ...user, password: null }), routes }
        })
    )
}

export async function updateUserRole(userId: string, role: string) {
    const [updated] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).returning()
    if (!updated) throw new AppError('User not found', 404)
    return mapUser({ ...updated, password: null })
}

export async function deleteUser(userId: string) {
    const result = await db.delete(users).where(eq(users.id, userId)).returning()
    if (!result.length) throw new AppError('User not found', 404)
}

export async function addVerifiedUser(name: string, email: string, password: string) {
    const existing = await findUserByEmail(email)
    if (existing) throw new AppError('Email already exist', 400)

    await db.insert(users).values({
        id: createId(),
        name,
        email,
        password: await hashPassword(password),
        isVerified: true
    })
}

export async function verifyUserById(userId: string) {
    const [updated] = await db.update(users).set({ isVerified: true, updatedAt: new Date() }).where(eq(users.id, userId)).returning()
    if (!updated) throw new AppError('User Does not exist', 400)
}

export async function assignRoute(userId: string, route: string) {
    const user = await findUserById(userId)
    if (!user) throw new AppError('User does not exist', 400)
    if (!route) throw new AppError('Assign appropriate route', 400)

    await db.insert(userRoutes).values({ id: createId(), userId, route }).onConflictDoNothing()
}

export async function deleteAssignedRoute(userId: string, index: number) {
    const routes = await db.select().from(userRoutes).where(eq(userRoutes.userId, userId)).orderBy(userRoutes.createdAt)
    if (index < 0 || index >= routes.length) throw new AppError('Invalid index', 400)
    await db.delete(userRoutes).where(eq(userRoutes.id, routes[index].id))
    const remaining = routes.filter((_, i) => i !== index).map((r) => r.route)
    return remaining
}
