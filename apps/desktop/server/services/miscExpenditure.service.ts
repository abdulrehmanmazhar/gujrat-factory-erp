import { getClient } from '../utils/db.js'
import { AppError } from '../utils/errors.js'
import { createId } from '../utils/mappers.js'
import { deleteRemoteFile } from '../utils/rclone.js'

export const PAYMENT_MODES = ['cash', 'online'] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

function assertPaymentMode(value: string): PaymentMode {
    if (!PAYMENT_MODES.includes(value as PaymentMode)) {
        throw new AppError('Payment mode must be cash or online', 400)
    }
    return value as PaymentMode
}

async function getExpenditureWithCreator(id: string) {
    const client = getClient()
    const result = await client.execute({
        sql: `
            SELECT
                e.id,
                e.amount,
                e.payment_mode,
                e.note,
                e.proof_image,
                e.proof_image_public_id,
                e.created_by_id,
                e.created_at,
                e.updated_at,
                u.id AS creator_id,
                u.name AS creator_name,
                u.contact AS creator_contact,
                u.role AS creator_role
            FROM miscellaneous_expenditures e
            LEFT JOIN users u ON u.id = e.created_by_id
            WHERE e.id = ?
            LIMIT 1
        `,
        args: [id]
    })

    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) return null

    return {
        id: String(row.id),
        _id: String(row.id),
        amount: Number(row.amount),
        paymentMode: String(row.payment_mode) as PaymentMode,
        note: String(row.note),
        proofImage: row.proof_image ? String(row.proof_image) : null,
        proofImagePublicId: row.proof_image_public_id ? String(row.proof_image_public_id) : null,
        createdById: String(row.created_by_id),
        createdAt: new Date(Number(row.created_at)).toISOString(),
        updatedAt: new Date(Number(row.updated_at)).toISOString(),
        createdBy: row.creator_id
            ? {
                  id: String(row.creator_id),
                  _id: String(row.creator_id),
                  name: String(row.creator_name),
                  contact: String(row.creator_contact),
                  role: String(row.creator_role),
                  isVerified: true
              }
            : null
    }
}

export async function listMiscellaneousExpenditures() {
    const client = getClient()
    const result = await client.execute({
        sql: `
            SELECT id
            FROM miscellaneous_expenditures
            ORDER BY created_at DESC
        `
    })

    const rows = await Promise.all(result.rows.map(async (row) => getExpenditureWithCreator(String((row as unknown as { id: string }).id))))

    return rows.filter(Boolean)
}

export async function createMiscellaneousExpenditure(data: {
    amount: number
    paymentMode: string
    note: string
    proofImage?: string
    proofImagePublicId?: string
    createdById: string
}) {
    const amount = Number(data.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Amount must be greater than zero', 400)
    }

    const note = data.note.trim()
    if (!note) {
        throw new AppError('Note is required', 400)
    }

    const paymentMode = assertPaymentMode(data.paymentMode)
    const id = createId()
    const now = Date.now()

    await getClient().execute({
        sql: `
            INSERT INTO miscellaneous_expenditures
            (id, amount, payment_mode, note, proof_image, proof_image_public_id, created_by_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [id, amount, paymentMode, note, data.proofImage ?? null, data.proofImagePublicId ?? null, data.createdById, now, now]
    })

    return getExpenditureWithCreator(id)
}

export async function deleteMiscellaneousExpenditure(id: string) {
    const existing = await getExpenditureWithCreator(id)
    if (!existing) throw new AppError('Expenditure not found', 404)

    if (existing.proofImagePublicId) {
        await deleteRemoteFile(existing.proofImagePublicId)
    }

    await getClient().execute({
        sql: 'DELETE FROM miscellaneous_expenditures WHERE id = ?',
        args: [id]
    })
}
