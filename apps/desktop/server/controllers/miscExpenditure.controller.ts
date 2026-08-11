import path from 'node:path'
import fs from 'node:fs'
import { moduleDir } from '../utils/esm.js'

const __dirname = moduleDir(import.meta.url)
import multer from 'multer'
import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { AppError } from '../utils/errors.js'
import { param } from '../utils/params.js'
import * as miscExpenditureService from '../services/miscExpenditure.service.js'
import { uploadFile } from '../utils/rclone.js'

const uploadDir = path.join(__dirname, '..', 'proofs')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => cb(null, `misc-exp-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
    }),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true)
        else cb(new Error('Only image files are allowed'))
    }
})

export const getMiscExpenditureCategories = CatchAsyncError(async (req: Request, res: Response) => {
    const categories = await miscExpenditureService.listMiscExpenditureCategories()
    httpResponse(req, res, 200, 'Expenditure categories fetched', { categories })
})

export const createMiscExpenditureCategory = CatchAsyncError(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name : ''
    const category = await miscExpenditureService.createMiscExpenditureCategory(name)
    httpResponse(req, res, 201, 'Expenditure category created', { category })
})

export const getMiscExpenditures = CatchAsyncError(async (req: Request, res: Response) => {
    const expenditures = await miscExpenditureService.listMiscellaneousExpenditures()
    httpResponse(req, res, 200, 'Miscellaneous expenditures fetched', { expenditures })
})

export const createMiscExpenditure = [
    upload.single('proofImage'),
    CatchAsyncError(async (req: Request, res: Response) => {
        const { amount, paymentMode, note, categoryId } = req.body
        if (!amount || !paymentMode || !note || !categoryId) {
            throw new AppError('Amount, payment mode, note, and category are required', 400)
        }

        let proofImage: string | undefined
        let proofImagePublicId: string | undefined

        if (req.file) {
            const relativePath = `proofs/${path.basename(req.file.filename)}`
            const uploaded = await uploadFile(req.file.path, relativePath, req)
            proofImage = uploaded.url ?? uploaded.remotePath
            proofImagePublicId = uploaded.remotePath
            fs.unlinkSync(req.file.path)
        }

        const expenditure = await miscExpenditureService.createMiscellaneousExpenditure({
            amount,
            paymentMode,
            note,
            categoryId,
            proofImage,
            proofImagePublicId,
            createdById: req.user!.id
        })

        httpResponse(req, res, 201, 'Miscellaneous expenditure recorded', { expenditure })
    })
]

export const deleteMiscExpenditure = CatchAsyncError(async (req: Request, res: Response) => {
    await miscExpenditureService.deleteMiscellaneousExpenditure(param(req.params.id))
    httpResponse(req, res, 200, 'Miscellaneous expenditure deleted', null)
})
