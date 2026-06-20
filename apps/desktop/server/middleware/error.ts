import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'
import { httpError } from '../utils/http.js'
import type { THttpError } from 'server-util'

export const CatchAsyncError = (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(handler(req, res, next)).catch((error) => {
            if (error instanceof AppError) {
                return next(httpError(next, error, req, error.statusCode))
            }
            return next(httpError(next, error instanceof Error ? error : new Error('Something went wrong'), req, 500))
        })
    }
}

export const errorMiddleware = (err: THttpError, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode).json({
        success: err.success,
        message: err.message,
        statusCode: err.statusCode,
        request: err.request,
        data: err.data,
        ...(err.trace ? { trace: err.trace } : {})
    })
}
