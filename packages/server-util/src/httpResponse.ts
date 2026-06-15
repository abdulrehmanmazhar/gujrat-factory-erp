import type { Request, Response } from 'express'
import { type ILogger, type IConfig, type THttpResponse, EApplicationEnvironment } from './types.js'

export default (logger: ILogger, config: IConfig) =>
    (req: Request, res: Response, responseStatusCode: number, responseMessage: string, data: unknown = null): void => {
        const response: THttpResponse = {
            success: true,
            statusCode: responseStatusCode,
            request: {
                ip: req.ip || null,
                method: req.method,
                url: req.originalUrl
            },
            message: responseMessage,
            data
        }

        // LOG (request metadata only — full response data can blow up log size and crash BSON transports)
        logger.info(`CONTROLLER RESPONSE`, {
            meta: {
                success: response.success,
                statusCode: response.statusCode,
                request: response.request,
                message: response.message
            }
        })

        // Production environment - remove IP address from response
        if (config.ENV === EApplicationEnvironment.PRODUCTION) {
            delete response.request.ip
        }

        res.status(responseStatusCode).json(response)
    }
