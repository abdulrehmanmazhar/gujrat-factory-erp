import bcrypt from 'bcryptjs'
import Jwt from 'jsonwebtoken'
import { appConfig } from '../config/env.js'

export async function hashPassword(password: string) {
    return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash)
}

export function signAccessToken(userId: string) {
    return Jwt.sign({ id: userId }, appConfig.ACCESS_TOKEN, { expiresIn: '5m' })
}

export function signRefreshToken(userId: string) {
    return Jwt.sign({ id: userId }, appConfig.REFRESH_TOKEN, { expiresIn: '3d' })
}

export function signActivationToken(payload: object) {
    return Jwt.sign(payload, appConfig.ACTIVATION_SECRET, { expiresIn: '5m' })
}

export function verifyActivationToken<T>(token: string) {
    return Jwt.verify(token, appConfig.ACTIVATION_SECRET) as T
}

export function signResetToken(payload: object) {
    return Jwt.sign(payload, appConfig.ACTIVATION_SECRET, { expiresIn: '15m' })
}

export function verifyResetToken<T>(token: string) {
    return Jwt.verify(token, appConfig.ACTIVATION_SECRET) as T
}
