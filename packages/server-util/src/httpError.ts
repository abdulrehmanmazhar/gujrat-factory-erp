import type { NextFunction, Request } from 'express'
import errorObject from './errorObject.js'
import type { IConfig, ILogger } from './types.js'

export default (logger: ILogger, config: IConfig) =>
    (nextFunc: NextFunction, error: Error, req: Request, statusCode: number = 500) => {
        const errObj = errorObject(logger, config)(error, req, statusCode)
        return nextFunc(errObj)
    }
