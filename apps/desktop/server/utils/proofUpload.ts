import path from 'node:path'
import fs from 'node:fs'
import multer from 'multer'
import type { Request } from 'express'
import { moduleDir } from './esm.js'
import { uploadFile } from './rclone.js'

const __dirname = moduleDir(import.meta.url)
const uploadDir = path.join(__dirname, '..', 'proofs')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

export const proofImageUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => cb(null, `proof-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
    }),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true)
        else cb(new Error('Only image files are allowed'))
    }
})

export async function uploadProofImageFromRequest(req: Request) {
    if (!req.file) return undefined

    const relativePath = `proofs/${path.basename(req.file.filename)}`
    const uploaded = await uploadFile(req.file.path, relativePath, req)
    fs.unlinkSync(req.file.path)
    return uploaded
}
