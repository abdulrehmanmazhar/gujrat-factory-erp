import { getClient } from './db.js'
import { ERP_WALKTHROUGH } from './erpWalkthrough.js'

/** Tables the analytics bot should usually skip even though they exist in SQLite. */
const ANALYTICS_IGNORE_TABLES = new Set(['user_gemini_api_keys', 'ai_chat_sessions', 'ai_chat_messages', 'whatsapp_queue'])

export async function getDatabaseSchema(): Promise<string> {
    const client = getClient()
    const tables = await client.execute(`
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '__drizzle%'
        ORDER BY name
    `)

    const sections = tables.rows
        .map((row) => {
            const name = String(row.name)
            const sql = String(row.sql ?? '')
            const note = ANALYTICS_IGNORE_TABLES.has(name)
                ? '\n-- NOTE: meta/system table — avoid for business KPI analytics unless explicitly asked'
                : ''
            return `-- Table: ${name}${note}\n${sql}`
        })
        .filter(Boolean)

    return `${ERP_WALKTHROUGH}\n\n-- Live SQLite DDL (source of truth for column names)\n${sections.join('\n\n')}`
}
