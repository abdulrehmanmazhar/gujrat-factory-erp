import { migrate } from 'drizzle-orm/libsql/migrator'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { appConfig } from '../config/env.js'
import { logger } from '../config/logger.js'
import { moduleDir } from './esm.js'
import * as schema from '../models/tables.js'

const serverRoot = path.join(moduleDir(import.meta.url), '..')

const dbUrl = appConfig.DATABASE_URL
const filePath = dbUrl.replace(/^file:/, '')

if (filePath && filePath !== ':memory:') {
    const dir = path.dirname(path.resolve(filePath))
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

const client = createClient({ url: dbUrl })

export const db = drizzle(client, { schema })

async function runMigrations() {
    const migrationsFolder = path.join(serverRoot, 'migrations')

    if (!fs.existsSync(migrationsFolder)) {
        throw new Error(`Migrations folder not found at ${migrationsFolder}`)
    }

    logger.info('Running database migrations', { meta: { migrationsFolder } })
    await migrate(db, { migrationsFolder })
    logger.info('Database migrations applied')
}

export async function connectDB() {
    try {
        await client.execute('SELECT 1')
        await runMigrations()
        logger.info('Database connected', { meta: { url: dbUrl } })
    } catch (error) {
        logger.error('Database connection failed', { meta: { error } })
        setTimeout(connectDB, 5000)
    }
}

export { schema }
