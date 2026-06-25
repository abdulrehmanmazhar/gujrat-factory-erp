import { Request, Response } from 'express'
import Jwt from 'jsonwebtoken'
import path from 'node:path'
import fs from 'node:fs'
import multer from 'multer'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { appConfig } from '../config/env.js'
import { param } from '../utils/params.js'
import { accessTokenOptions, refreshTokenOptions, sendToken } from '../utils/jwt.js'
import { moduleDir } from '../utils/esm.js'
import * as userService from '../services/user.service.js'
import { deleteRemoteFile, uploadBuffer, uploadFile } from '../utils/rclone.js'

const __dirname = moduleDir(import.meta.url)
const avatarUploadDir = path.join(__dirname, '..', 'uploads', 'avatars')
if (!fs.existsSync(avatarUploadDir)) fs.mkdirSync(avatarUploadDir, { recursive: true })

const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, avatarUploadDir),
        filename: (_req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname) || '.jpg'}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true)
        else cb(new Error('Only image files are allowed'))
    }
})

export const registrationUser = CatchAsyncError(async (req: Request, res: Response) => {
    const { name, contact, password } = req.body
    const result = await userService.registerUser(name, contact, password)
    httpResponse(req, res, 201, 'Verification code sent to your WhatsApp number', result)
})

export const activateUser = CatchAsyncError(async (req: Request, res: Response) => {
    const { activation_token, activation_code } = req.body
    await userService.activateUser(activation_token, activation_code)
    httpResponse(req, res, 201, 'user activated successfully', null)
})

export const LoginUser = CatchAsyncError(async (req: Request, res: Response) => {
    const { contact, password } = req.body
    if (!contact || !password) throw new AppError('Please enter WhatsApp number and password', 400)
    const result = await userService.loginUser(contact, password)
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
    const user = await userService.getUserProfile(req.user!.id)
    httpResponse(req, res, 200, 'User fetched successfully', { user })
})

export const updateUserInfo = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.updateUserInfo(req.user!.id, req.body.name, req.body.contact)
    httpResponse(req, res, 200, 'User updated successfully', { user })
})

export const updatePassword = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.updateUserPassword(req.user!.id, req.body.oldPassword, req.body.newPassword)
    httpResponse(req, res, 201, 'Password updated successfully', { user })
})

export const updateProfilePicture = [
    avatarUpload.single('avatar'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const userId = req.user!.id
        const existing = await userService.findUserById(userId)
        if (!existing) throw new AppError('User not found', 404)

        let publicId: string | undefined
        let url: string | undefined

        if (req.file) {
            const ext = path.extname(req.file.originalname) || path.extname(req.file.filename) || '.jpg'
            const relativePath = `avatars/${userId}${ext}`
            const uploaded = await uploadFile(req.file.path, relativePath, req)
            publicId = uploaded.remotePath
            url = uploaded.url ?? uploaded.remotePath
            fs.unlinkSync(req.file.path)
        } else if (req.body.avatar) {
            const dataUrl = String(req.body.avatar)
            const match = dataUrl.match(/^data:image\/[\w+.-]+;base64,(.+)$/)
            const base64 = match ? match[1] : dataUrl
            const buffer = Buffer.from(base64, 'base64')
            const relativePath = `avatars/${userId}.jpg`
            const uploaded = await uploadBuffer(buffer, relativePath, req)
            publicId = uploaded.remotePath
            url = uploaded.url ?? uploaded.remotePath
        } else {
            throw new AppError('Avatar image is required', 400)
        }

        if (existing.avatarPublicId && existing.avatarPublicId !== publicId) {
            await deleteRemoteFile(existing.avatarPublicId)
        }

        const user = await userService.updateUserAvatar(userId, publicId!, url!)
        httpResponse(req, res, 200, 'Avatar updated successfully', { user })
    })
]

export const fetchAllUsers = CatchAsyncError(async (req: Request, res: Response) => {
    const users = await userService.listUsers()
    httpResponse(req, res, 200, 'Users fetched successfully', { users })
})

export const updateRole = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.updateUserRole(req.body.id, req.body.role, req.user!.id)
    httpResponse(req, res, 201, 'Role updated successfully', { user })
})

export const deleteUser = CatchAsyncError(async (req: Request, res: Response) => {
    await userService.deleteUser(param(req.params.id), req.user!.id)
    httpResponse(req, res, 200, 'User deleted successfully', null)
})

export const addUser = CatchAsyncError(async (_req: Request, _res: Response) => {
    throw new AppError('Manual user creation is disabled. Users must register through sign up.', 403)
})

export const verifyUser = CatchAsyncError(async (req: Request, res: Response) => {
    const user = await userService.verifyUserById(param(req.params.id), req.user!.id)
    httpResponse(req, res, 201, 'user verified successfully', { user })
})

export const forgotPassword = CatchAsyncError(async (req: Request, res: Response) => {
    const { contact } = req.body
    if (!contact) throw new AppError('WhatsApp number is required', 400)
    const result = await userService.requestPasswordReset(contact)
    httpResponse(req, res, 200, 'If an account exists for this number, a reset code has been sent on WhatsApp', result)
})

export const resetPassword = CatchAsyncError(async (req: Request, res: Response) => {
    const { reset_token, reset_code, new_password } = req.body
    if (!reset_token || !reset_code || !new_password) throw new AppError('Missing required fields', 400)
    const user = await userService.resetPassword(reset_token, reset_code, new_password)
    httpResponse(req, res, 200, 'Password reset successfully', { user })
})
