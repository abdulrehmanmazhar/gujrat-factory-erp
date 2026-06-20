import express, { Request, Response, NextFunction } from 'express'
import Jwt, { JwtPayload } from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { users } from '../models/tables.js'
import { CatchAsyncError } from './catchAsyncError.js'
import { AppError } from '../utils/errors.js'
import { httpError } from '../utils/http.js'
import { appConfig } from '../config/env.js'
import { mapUser } from '../utils/mappers.js'
import { getUserRoutes } from '../services/user.service.js'

export const isAuthenticated = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.cookies.access_token
    if (!accessToken) throw new AppError('User is not authenticated', 401)

    try {
        const decoded = Jwt.verify(accessToken, appConfig.ACCESS_TOKEN) as JwtPayload
        if (!decoded?.id) throw new AppError('Access token is not valid', 400)

        const [user] = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1)
        if (!user) throw new AppError('User not found', 400)

        const routes = await getUserRoutes(user.id)
        req.user = { ...mapUser({ ...user, password: null }), routes, _id: user.id, id: user.id } as Express.Request['user']
        next()
    } catch (error: any) {
        if (error instanceof AppError) throw error
        if (error?.name === 'TokenExpiredError') throw new AppError('JWT token has expired', 401)
        throw new AppError('Authentication failed', 400)
    }
})

export const authorizeRoles = (...roles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user?.role || !roles.includes(req.user.role)) {
            return next(httpError(next, new AppError(`Role: ${req.user?.role} is not allowed to access this resource`, 403), req, 403))
        }
        next()
    }
}
