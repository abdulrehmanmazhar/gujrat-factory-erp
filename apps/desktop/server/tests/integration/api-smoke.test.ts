import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import http, { type Server } from 'node:http'
import path from 'node:path'
import Jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databasePath = path.resolve(process.cwd(), 'data', `test-erp-${process.pid}-${randomUUID()}.db`)
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = `file:${databasePath.replace(/\\/g, '/')}`
process.env.ACCESS_TOKEN = 'test-access-secret'
process.env.REFRESH_TOKEN = 'test-refresh-secret'
process.env.ACTIVATION_SECRET = 'test-activation-secret'
process.env.PORT = '0'

let server: Server
let baseUrl = ''
let db: typeof import('../../utils/db.js').db
let users: typeof import('../../models/tables.js').users
let customerTransactions: typeof import('../../models/tables.js').customerTransactions
let createId: typeof import('../../utils/mappers.js').createId

const adminId = randomUUID()
const readOnlyId = randomUUID()
const superAdminId = randomUUID()

function accessCookie(id: string) {
    return `access_token=${Jwt.sign({ id }, process.env.ACCESS_TOKEN!, { expiresIn: '10m' })}`
}

beforeAll(async () => {
    const dbModule = await import('../../utils/db.js')
    const tableModule = await import('../../models/tables.js')
    const mapperModule = await import('../../utils/mappers.js')
    const { app } = await import('../../app.js')

    db = dbModule.db
    users = tableModule.users
    customerTransactions = tableModule.customerTransactions
    createId = mapperModule.createId
    await dbModule.connectDB()

    await db.insert(users).values([
        {
            id: adminId,
            name: 'Test Admin',
            contact: `923000${Math.floor(Math.random() * 900000 + 100000)}`,
            password: 'not-used-by-cookie-tests',
            role: 'admin',
            isVerified: true
        },
        {
            id: readOnlyId,
            name: 'Test User',
            contact: `923001${Math.floor(Math.random() * 900000 + 100000)}`,
            password: 'not-used-by-cookie-tests',
            role: 'User',
            isVerified: true
        },
        {
            id: superAdminId,
            name: 'Test Super Admin',
            contact: `923002${Math.floor(Math.random() * 900000 + 100000)}`,
            password: 'not-used-by-cookie-tests',
            role: 'super_admin',
            isVerified: true
        }
    ])

    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port')
    baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    const dbModule = await import('../../utils/db.js')
    await (dbModule.getClient() as unknown as { close?: () => Promise<void> | void }).close?.()

    for (const suffix of ['', '-wal', '-shm']) {
        const file = `${databasePath}${suffix}`
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                fs.rmSync(file, { force: true })
                break
            } catch (error: any) {
                // libsql can retain the Windows file handle until the Vitest worker exits.
                // The next integration boot uses a fresh DB; a later process removes stale
                // test files after this worker has terminated.
                if (error?.code !== 'EBUSY' || attempt === 9) {
                    if (error?.code === 'EBUSY') break
                    throw error
                }
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
        }
    }
})

describe('isolated HTTP server', () => {
    it('starts on a random port and serves the health endpoint', async () => {
        const response = await request(baseUrl).get('/test')
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
    })

    it('enforces authentication and role-gated write access', async () => {
        const unauthenticated = await request(baseUrl).get('/api/v1/me')
        expect(unauthenticated.status).toBe(401)

        const authenticated = await request(baseUrl).get('/api/v1/me').set('Cookie', accessCookie(adminId))
        expect(authenticated.status).toBe(200)
        expect(authenticated.body.data.user.id).toBe(adminId)

        const userWrite = await request(baseUrl)
            .post('/api/v1/units')
            .set('Cookie', accessCookie(readOnlyId))
            .send({ name: `Read only unit ${createId()}` })
        expect(userWrite.status).toBe(403)

        const adminWrite = await request(baseUrl)
            .post('/api/v1/units')
            .set('Cookie', accessCookie(adminId))
            .send({ name: `Admin unit ${createId()}` })
        expect(adminWrite.status).toBe(201)
    })

    it('exposes paginated WhatsApp queue data only to authenticated users', async () => {
        const response = await request(baseUrl)
            .get('/api/v1/whatsapp/queue?status=failed&page=1&limit=20')
            .set('Cookie', accessCookie(adminId))
        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({ page: 1, limit: 20, total: 0 })
        expect(response.body.data.items).toEqual([])
    })

    it('creates customer records, rejects duplicates, and preserves read-only permissions', async () => {
        const contact = `92302${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`
        const payload = { name: 'Integration Customer', address: 'Test Address', contact }

        const readOnly = await request(baseUrl).post('/api/v1/add-customer').set('Cookie', accessCookie(readOnlyId)).send(payload)
        expect(readOnly.status).toBe(403)

        const created = await request(baseUrl).post('/api/v1/add-customer').set('Cookie', accessCookie(adminId)).send(payload)
        expect(created.status).toBe(200)
        expect(created.body.data.customer).toMatchObject({ name: payload.name, contact })
        expect(created.body.data.customer).not.toHaveProperty('udhar')

        const duplicate = await request(baseUrl).post('/api/v1/add-customer').set('Cookie', accessCookie(adminId)).send(payload)
        expect(duplicate.status).toBe(400)
    })

    it('searches customer analytics by transaction notes and lets only super-admin delete txns', async () => {
        const contact = `92303${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`
        const created = await request(baseUrl)
            .post('/api/v1/add-customer')
            .set('Cookie', accessCookie(adminId))
            .send({ name: 'Notes Search Customer', address: 'Ledger Lane', contact })
        expect(created.status).toBe(200)
        const customerId = created.body.data.customer.id as string

        const txnId = createId()
        await db.insert(customerTransactions).values({
            id: txnId,
            customerId,
            type: 'order',
            amount: 250,
            description: 'Unique invoice note zebra-ledger',
            createdById: adminId,
            paymentMode: 'cash'
        })

        const byNote = await request(baseUrl)
            .get('/api/v1/analytics/customers?q=zebra-ledger')
            .set('Cookie', accessCookie(adminId))
        expect(byNote.status).toBe(200)
        const match = byNote.body.data.customers.find((row: { id: string }) => row.id === customerId)
        expect(match).toBeTruthy()
        expect(match.totalOut).toBe(250)
        expect(match.netAmount).toBe(-250)
        expect(match).not.toHaveProperty('udhar')

        const adminDelete = await request(baseUrl).delete(`/api/v1/delete-transaction/${txnId}`).set('Cookie', accessCookie(adminId))
        expect(adminDelete.status).toBe(403)

        const superDelete = await request(baseUrl).delete(`/api/v1/delete-transaction/${txnId}`).set('Cookie', accessCookie(superAdminId))
        expect(superDelete.status).toBe(200)

        const afterDelete = await request(baseUrl)
            .get('/api/v1/analytics/customers?q=zebra-ledger')
            .set('Cookie', accessCookie(adminId))
        expect(afterDelete.body.data.customers.find((row: { id: string }) => row.id === customerId)).toBeUndefined()
    })

    it('rejects invalid conversion requests before inventory can be mutated', async () => {
        const missingFields = await request(baseUrl).post('/api/v1/conversions').set('Cookie', accessCookie(adminId)).send({})
        expect(missingFields.status).toBe(400)

        const readOnly = await request(baseUrl)
            .post('/api/v1/conversions')
            .set('Cookie', accessCookie(readOnlyId))
            .send({ inputProductId: 'a', outputProductId: 'b', inputRatio: 1, outputRatio: 1, inputQty: 1 })
        expect(readOnly.status).toBe(403)
    })

    it('supports nested miscellaneous expenditure categories and delete guards', async () => {
        const suffix = createId().slice(0, 8)
        const parentCreated = await request(baseUrl)
            .post('/api/v1/miscellaneous-expenditure-categories')
            .set('Cookie', accessCookie(adminId))
            .send({ name: `Utilities ${suffix}` })
        expect(parentCreated.status).toBe(201)
        const parentId = parentCreated.body.data.category.id as string

        const childCreated = await request(baseUrl)
            .post('/api/v1/miscellaneous-expenditure-categories')
            .set('Cookie', accessCookie(adminId))
            .send({ name: `Electricity ${suffix}`, parentId })
        expect(childCreated.status).toBe(201)
        const childId = childCreated.body.data.category.id as string
        expect(childCreated.body.data.category.parentId).toBe(parentId)
        expect(childCreated.body.data.category.path).toContain('Electricity')

        const duplicateSibling = await request(baseUrl)
            .post('/api/v1/miscellaneous-expenditure-categories')
            .set('Cookie', accessCookie(adminId))
            .send({ name: `electricity ${suffix}`, parentId })
        expect(duplicateSibling.status).toBe(400)

        const listed = await request(baseUrl)
            .get('/api/v1/miscellaneous-expenditure-categories')
            .set('Cookie', accessCookie(adminId))
        expect(listed.status).toBe(200)
        const parentNode = listed.body.data.categories.find((row: { id: string }) => row.id === parentId)
        expect(parentNode?.children?.some((child: { id: string }) => child.id === childId)).toBe(true)

        const cycle = await request(baseUrl)
            .put(`/api/v1/miscellaneous-expenditure-categories/${parentId}`)
            .set('Cookie', accessCookie(adminId))
            .send({ parentId: childId })
        expect(cycle.status).toBe(400)

        const deleteParent = await request(baseUrl)
            .delete(`/api/v1/miscellaneous-expenditure-categories/${parentId}`)
            .set('Cookie', accessCookie(superAdminId))
        expect(deleteParent.status).toBe(400)

        const recorded = await request(baseUrl)
            .post('/api/v1/miscellaneous-expenditures')
            .set('Cookie', accessCookie(adminId))
            .field('amount', '150')
            .field('paymentMode', 'cash')
            .field('note', 'Factory bill')
            .field('categoryId', childId)
        expect(recorded.status).toBe(201)
        expect(recorded.body.data.expenditure.category.path).toContain('Electricity')

        const summed = await request(baseUrl)
            .get('/api/v1/miscellaneous-expenditure-categories')
            .set('Cookie', accessCookie(adminId))
        const summedParent = summed.body.data.categories.find((row: { id: string }) => row.id === parentId)
        expect(summedParent.expenditureTotal).toBe(150)
        expect(summedParent.expenditureCount).toBe(1)
        expect(summedParent.children.find((child: { id: string }) => child.id === childId).expenditureTotal).toBe(150)

        const adminDeleteCategory = await request(baseUrl)
            .delete(`/api/v1/miscellaneous-expenditure-categories/${childId}`)
            .set('Cookie', accessCookie(adminId))
        expect(adminDeleteCategory.status).toBe(403)

        const deleteLinked = await request(baseUrl)
            .delete(`/api/v1/miscellaneous-expenditure-categories/${childId}`)
            .set('Cookie', accessCookie(superAdminId))
        expect(deleteLinked.status).toBe(400)
    })

    it('requires selected orders before generating an order sheet', async () => {
        const empty = await request(baseUrl)
            .post('/api/v1/generate-order-sheet')
            .set('Cookie', accessCookie(adminId))
            .send({ orderIds: [] })
        expect(empty.status).toBe(400)

        const readOnly = await request(baseUrl)
            .post('/api/v1/generate-order-sheet')
            .set('Cookie', accessCookie(readOnlyId))
            .send({ orderIds: ['x'] })
        expect(readOnly.status).toBe(403)
    })
})
