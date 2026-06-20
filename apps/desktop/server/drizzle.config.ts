import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

export default defineConfig({
    schema: './models/tables.ts',
    out: './migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'file:./data/erp.db'
    }
})
