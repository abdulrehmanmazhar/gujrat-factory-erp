import express, { Response } from 'express'
import { appConfig } from '../config/env.js'

interface ITokenOptions {
    expires: Date
    maxAge: number
    httpOnly: boolean
    sameSite: 'lax' | 'strict' | 'none' | undefined
    secure?: boolean
}

export const accessTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + appConfig.ACCESS_TOKEN_EXPIRE + 1000 * 60 * 60),
    maxAge: appConfig.ACCESS_TOKEN_EXPIRE + 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true
}

export const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + appConfig.REFRESH_TOKEN_EXPIRE + 1000 * 60 * 60 * 24),
    maxAge: appConfig.REFRESH_TOKEN_EXPIRE + 60 * 60 * 24 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true
}

export const sendToken = (user: object, accessToken: string, refreshToken: string, statusCode: number, res: Response) => {
    if (appConfig.ENV === 'production') {
        accessTokenOptions.secure = true
    }

    res.cookie('access_token', accessToken, accessTokenOptions)
    res.cookie('refresh_token', refreshToken, refreshTokenOptions)

    res.status(statusCode).json({
        success: true,
        user,
        accessToken
    })
}
