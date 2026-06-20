import { Request, Response } from 'express'
import Jwt from 'jsonwebtoken'
import cloudinary from 'cloudinary'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { appConfig } from '../config/env.js'
import { param } from '../utils/params.js'
import { accessTokenOptions, refreshTokenOptions, sendToken } from '../utils/jwt.js'
import * as userService from '../services/user.service.js'

export const registrationUser = CatchAsyncError(async (req: Request, res: Response) => {
    const { name, email, password } = req.body
    const result = await userService.registerUser(name, email, password)
    httpResponse(req, res, 201, `Please check your email ${email} to activate your account`, result)
})

export const activateUser = CatchAsyncError(async (req: Request, res: Response) => {
    const { activation_token, activation_code } = req.body
    await userService.activateUser(activation_token, activation_code)
    httpResponse(req, res, 201, 'user activated successfully', null)
})

export const LoginUser = CatchAsyncError(async (req: Request, res: Response) => {
    const { email, password } = req.body
    if (!email || !password) throw new AppError('Please enter email and password', 400)
    const result = await userService.loginUser(email, password)
    sendToken(result.user, result.accessToken, result.refreshToken, 200, res)
})

export const logoutUser = CatchAsyncError(async (req: Request, res: Response) => {
    res.cookie('access_token', '', { maxAge: 1, sameSite: 'none', secure: true })
    res.cookie('refresh_token', '', { maxAge: 1, sameSite: 'none', secure: true })
    httpResponse(req, res, 201, 'Logged out successfully', null)
})

export const updateAccessToken = CatchAsyncError(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refresh_token as string
    const decoded = Jwt.verify(refreshToken, appConfig.REFRESH_TOKEN) as { id: string }
    const result = await userService.refreshAccessToken(decoded.id)
    req.user = { ...result.user, _id: result.user.id, id: result.user.id } as Express.Request['user']
    res.cookie('access_token', result.accessToken, accessTokenOptions)
    res.cookie('refresh_token', result.refreshToken, refreshTokenOptions)
    res.status(200).json({ status: 'success', accessToken: result.accessToken })
})

export const getUserInfo = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.getUserWithRoutes(req.user!.id)
    httpResponse(req, res, 200, 'User fetched successfully', { user })
})

export const socialAuth = CatchAsyncError(async (req: Request, res: Response) => {
    const { email, name, avatar } = req.body
    const result = await userService.createSocialUser(email, name, avatar)
    sendToken(result.user, result.accessToken, result.refreshToken, 200, res)
})

export const updateUserInfo = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.updateUserInfo(req.user!.id, req.body.name, req.body.email)
    httpResponse(req, res, 200, 'User updated successfully', { user })
})

export const updatePassword = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.updateUserPassword(req.user!.id, req.body.oldPassword, req.body.newPassword)
    httpResponse(req, res, 201, 'Password updated successfully', { user })
})

export const updateProfilePicture = CatchAsyncError(async (req: Request, res: Response) => {
    const { avatar } = req.body
    let publicId: string | undefined
    let url: string | undefined

    if (avatar) {
        const myCloud = await cloudinary.v2.uploader.upload(avatar, { folder: 'avatars', width: 150 })
        publicId = myCloud.public_id
        url = myCloud.secure_url
    }

    const user = await userService.updateUserAvatar(req.user!.id, publicId!, url!)
    httpResponse(req, res, 200, 'Avatar updated successfully', { user })
})

export const fetchAllUsers = CatchAsyncError(async (req: Request, res: Response) => {
    const users = await userService.listUsers()
    httpResponse(req, res, 200, 'Users fetched successfully', { users })
})

export const updateRole = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.updateUserRole(req.body.id, req.body.role)
    httpResponse(req, res, 201, 'Role updated successfully', { user })
})

export const deleteUser = CatchAsyncError(async (req: Request, res: Response) => {
    await userService.deleteUser(param(req.params.id))
    httpResponse(req, res, 200, 'User deleted successfully', null)
})

export const addUser = CatchAsyncError(async (req: Request, res: Response) => {
    await userService.addVerifiedUser(req.body.name, req.body.email, req.body.password)
    httpResponse(req, res, 201, 'user added successfully', null)
})

export const verifyUser = CatchAsyncError(async (req: Request, res: Response) => {
    await userService.verifyUserById(param(req.params.id))
    httpResponse(req, res, 201, 'user verified successfully', null)
})

export const routeAssign = CatchAsyncError(async (req: Request, res: Response) => {
    await userService.assignRoute(param(req.params.id), req.body.route)
    httpResponse(req, res, 201, 'Assigned route to user successfully', null)
})

export const routeAssignDeletion = CatchAsyncError(async (req: Request, res: Response) => {
    const remainingRoutes = await userService.deleteAssignedRoute(param(req.params.id), parseInt(param(req.params.index), 10))
    httpResponse(req, res, 200, 'Deleted assigned route from user successfully', { remainingRoutes })
})
