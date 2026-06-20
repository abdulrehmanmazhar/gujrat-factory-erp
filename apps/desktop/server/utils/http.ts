import { serverUtilities } from 'server-util'
import { appConfig } from '../config/env.js'
import { logger } from '../config/logger.js'

serverUtilities.configure(logger, appConfig)

export const httpResponse = serverUtilities.httpResponse()
export const httpError = serverUtilities.httpError()
