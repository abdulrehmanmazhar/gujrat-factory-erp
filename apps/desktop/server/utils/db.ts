import { migrate } from 'drizzle-orm/libsql/migrator'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type { Client } from '@libsql/client'
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

let clientInstance: Client | null = null
let dbInstance: LibSQLDatabase<typeof schema> | null = null

export function getClient(): Client {
    if (!clientInstance) {
        clientInstance = createClient({ url: dbUrl })
    }
    return clientInstance
}

function getDb() {
    if (!dbInstance) {
        dbInstance = drizzle(getClient(), { schema })
    }
    return dbInstance
}

/** Lazy proxy so importing this module does not open the SQLite file. */
export const client = new Proxy({} as Client, {
    get(_target, prop) {
        const value = (getClient() as unknown as Record<string | symbol, unknown>)[prop]
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(getClient()) : value
    }
})

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
    get(_target, prop) {
        const value = (getDb() as unknown as Record<string | symbol, unknown>)[prop]
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(getDb()) : value
    }
})

async function runMigrations() {
    const migrationsFolder = path.join(serverRoot, 'migrations')

    if (!fs.existsSync(migrationsFolder)) {
        throw new Error(`Migrations folder not found at ${migrationsFolder}`)
    }

    logger.info('Running database migrations', { meta: { migrationsFolder } })
    await migrate(getDb(), { migrationsFolder })
    logger.info('Database migrations applied')
}

export async function connectDB() {
    try {
        await getClient().execute('SELECT 1')
        await runMigrations()
        logger.info('Database connected', { meta: { url: dbUrl } })
    } catch (error) {
        logger.error('Database connection failed', { meta: { error } })
        setTimeout(connectDB, 5000)
    }
}

export { schema }
