import path from 'node:path'
import fs from 'node:fs'
import { moduleDir } from '../utils/esm.js'

const __dirname = moduleDir(import.meta.url)
import multer from 'multer'
import cloudinary from 'cloudinary'
import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as transactionService from '../services/transaction.service.js'

const uploadDir = path.join(__dirname, '..', 'proofs')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
    }),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true)
        else cb(new Error('Only image files are allowed!'))
    }
})

export const createTransaction = [
    upload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const { type, amount, description, orderId } = req.body
        if (!type || !amount || !description) throw new AppError('Missing required fields', 400)

        let proofImage: string | undefined
        if (req.file) {
            const myCloud = await cloudinary.v2.uploader.upload(req.file.path, { folder: 'proofs' })
            proofImage = myCloud.secure_url
        }

        const transaction = await transactionService.createTransaction({
            type,
            amount,
            description,
            createdById: req.user!.id,
            orderId: type === 'sale' ? orderId : undefined,
            proofImage
        })

        httpResponse(req, res, 200, 'Transaction created successfully', { transaction })
    })
]

export const deleteTransaction = CatchAsyncError(async (req: Request, res: Response) => {
    await transactionService.deleteTransaction(param(req.params.id))
    httpResponse(req, res, 200, 'Transaction removed successfully', null)
})

export const getTransactions = CatchAsyncError(async (req: Request, res: Response) => {
    const transactions = await transactionService.listTransactions()
    httpResponse(req, res, 200, 'Transactions fetched successfully', { transactions })
})

export const getTodayTransactions = CatchAsyncError(async (req: Request, res: Response) => {
    const transactions = await transactionService.listTodayTransactions()
    httpResponse(req, res, 200, 'Today transactions fetched successfully', { transactions })
})

export const getSales = CatchAsyncError(async (req: Request, res: Response) => {
    const { type, dateRange, startDate, endDate } = req.body
    const sales = await transactionService.getSalesByDateRange(dateRange, startDate, endDate)
    httpResponse(req, res, 200, 'Sales fetched successfully', { sales, type })
})
