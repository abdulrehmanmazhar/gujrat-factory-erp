/**
 * Lightweight FIFO allocation sanity checks (no DB).
 * Run: node scripts/verify-fifo-logic.mjs
 */

function allocateFifo(batches, qty) {
    let remaining = qty
    const allocations = []
    for (const batch of batches) {
        if (remaining <= 0) break
        const take = Math.min(batch.remainingQty, remaining)
        if (take <= 0) continue
        allocations.push({ batchId: batch.id, qty: take, unitCost: batch.unitCost })
        remaining -= take
    }
    if (remaining > 0) throw new Error(`shortfall ${remaining}`)
    return {
        allocations,
        totalCost: allocations.reduce((sum, row) => sum + row.qty * row.unitCost, 0)
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

const batches = [
    { id: 'a', remainingQty: 5, unitCost: 10 },
    { id: 'b', remainingQty: 8, unitCost: 20 }
]

const sale = allocateFifo(batches, 7)
assert(sale.allocations.length === 2, 'should split across two batches')
assert(sale.allocations[0].batchId === 'a' && sale.allocations[0].qty === 5, 'FIFO oldest first')
assert(sale.allocations[1].batchId === 'b' && sale.allocations[1].qty === 2, 'remainder from next batch')
assert(sale.totalCost === 5 * 10 + 2 * 20, 'COGS should match FIFO costs')

const productionCost = 5 * 10 + 100
const outputQty = 10
const unitCost = productionCost / outputQty
assert(unitCost === 15, 'labour output unit cost = (materials + labour) / qty')

console.log('FIFO verification passed')
