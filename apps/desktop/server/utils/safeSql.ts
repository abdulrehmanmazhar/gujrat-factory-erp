import pkg from 'node-sql-parser'
import { getClient } from './db.js'
import { AppError } from './errors.js'

const { Parser } = pkg
const parser = new Parser()

const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i

export function validateReadOnlySql(sql: string): string {
    const trimmed = sql.trim().replace(/;+\s*$/, '')
    if (!trimmed) throw new AppError('SQL query is empty', 400)

    if (FORBIDDEN_KEYWORDS.test(trimmed)) {
        throw new AppError('Only read-only SELECT queries are allowed', 400)
    }

    if (!/^\s*SELECT\b/i.test(trimmed) && !/^\s*WITH\b/i.test(trimmed)) {
        throw new AppError('Only SELECT queries (including WITH/CTE) are allowed', 400)
    }

    let ast: unknown
    try {
        ast = parser.astify(trimmed, { database: 'SQLite' })
    } catch (error) {
        throw new AppError(`Invalid SQL: ${error instanceof Error ? error.message : String(error)}`, 400)
    }

    const statements = Array.isArray(ast) ? ast : [ast]
    if (statements.length !== 1) {
        throw new AppError('Only a single SQL statement is allowed', 400)
    }

    const statement = statements[0] as { type?: string }
    if (statement.type !== 'select') {
        throw new AppError('Only SELECT queries are allowed', 400)
    }

    return trimmed
}

export async function runSafeSQL(query: string): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    const safeSql = validateReadOnlySql(query)
    const client = getClient()
    const result = await client.execute({ sql: safeSql, args: [] })
    const rows = (result.rows ?? []) as Record<string, unknown>[]
    return { rows, rowCount: rows.length }
}
