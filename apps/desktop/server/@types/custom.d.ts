import Express, { Request } from 'express'

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string
                _id: string
                name: string
                contact: string
                role: string
                isVerified: boolean
                avatar?: { public_id?: string | null; url?: string | null }
            }
            file?: Express.Multer.File
        }
    }
}
