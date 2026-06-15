export interface ILogger {
    info: (message: string, meta?: object) => void
    error: (message: string, meta?: object) => void
}
export interface IConfig {
    ENV: 'development' | 'production'
}

export type THttpResponse = {
    success: boolean
    statusCode: number
    request: {
        ip?: string | null
        method: string
        url: string
    }
    message: string
    data: unknown
}

export type THttpError = {
    success: boolean
    statusCode: number
    request: {
        ip?: string | null
        method: string
        url: string
    }
    message: string
    data: unknown
    trace?: object | null
}

export enum EApplicationEnvironment {
    DEVELOPMENT = 'development',
    PRODUCTION = 'production'
}
