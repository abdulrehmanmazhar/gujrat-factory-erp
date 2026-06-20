import 'dotenv/config'
import type { IConfig } from 'server-util'

const env: IConfig['ENV'] = process.env.NODE_ENV === 'production' ? 'production' : 'development'

export const appConfig = {
    ENV: env,
    PORT: parseInt(process.env.PORT || '5000', 10),
    DATABASE_URL: process.env.DATABASE_URL || 'file:./data/erp.db',
    ACCESS_TOKEN: process.env.ACCESS_TOKEN || '',
    REFRESH_TOKEN: process.env.REFRESH_TOKEN || '',
    ACTIVATION_SECRET: process.env.ACTIVATION_SECRET || '',
    ACCESS_TOKEN_EXPIRE: parseInt(process.env.ACCESS_TOKEN_EXPIRE || '300', 10),
    REFRESH_TOKEN_EXPIRE: parseInt(process.env.REFRESH_TOKEN_EXPIRE || '1200', 10)
}
