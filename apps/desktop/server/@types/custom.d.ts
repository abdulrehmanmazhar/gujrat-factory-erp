import Express, { Request } from 'express'

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string
                _id: string
                name: string
                email: string
                role: string
                isVerified: boolean
                routes: string[]
                avatar?: { public_id?: string | null; url?: string | null }
            }
            file?: Express.Multer.File
        }
    }
}
