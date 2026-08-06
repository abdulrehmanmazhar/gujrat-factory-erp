import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { getDatabaseSchema } from '../../utils/dbSchema.js'
import { runSafeSQL } from '../../utils/safeSql.js'

export async function toolGetDatabaseSchema() {
    return getDatabaseSchema()
}

export async function toolRunSafeSQL(query: string) {
    const result = await runSafeSQL(query)
    return JSON.stringify(result, null, 2)
}

export const getDatabaseSchemaTool = new DynamicStructuredTool({
    name: 'getDatabaseSchema',
    description: 'Returns the SQLite ERP database schema and business context. Call this before writing SQL.',
    schema: z.object({}),
    func: async () => toolGetDatabaseSchema()
})

export const runSafeSQLTool = new DynamicStructuredTool({
    name: 'runSafeSQL',
    description: 'Executes a read-only SELECT query against the local ERP SQLite database. Mutations are blocked.',
    schema: z.object({
        query: z.string().describe('A single SQLite SELECT statement (WITH/CTE allowed)')
    }),
    func: async ({ query }) => toolRunSafeSQL(query)
})

export const aiTools = [getDatabaseSchemaTool, runSafeSQLTool]
