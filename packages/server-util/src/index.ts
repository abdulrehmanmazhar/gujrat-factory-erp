import type { IConfig, ILogger } from './types.js'
import httpResponse from './httpResponse.js'
import httpError from './httpError.js'
class ServerUtils {
    private config!: IConfig
    private logger!: ILogger

    configure(logger: ILogger, config: IConfig) {
        this.logger = logger
        this.config = config
    }

    httpResponse() {
        if (!this.logger || !this.config) throw new Error('Please configure utils')
        return httpResponse(this.logger, this.config)
    }

    httpError() {
        if (!this.logger || !this.config) throw new Error('Please configure utils')
        return httpError(this.logger, this.config)
    }
}

export const serverUtilities = new ServerUtils()
