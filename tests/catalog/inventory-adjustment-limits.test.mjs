import test from 'node:test'
import assert from 'node:assert/strict'
import { adjustmentLimits, validateInventoryAdjustment } from '../../shared/features/inventory/adjustment-limits.js'
import { withInventoryTransaction } from '../../server/features/inventory/inventory-transaction.js'
import { adjustInventory } from '../../server/features/inventory/adjust-inventory.js'

test('retiro permite exactamente las piezas sin reservar, sin tocar las reservadas', () => {
  const lot = { onHandQty: 10, reservedQty: 4 }
  assert.equal(adjustmentLimits(lot).removableQty, 6)
  assert.doesNotThrow(() => validateInventoryAdjustment(lot, -6))
  assert.throws(() => validateInventoryAdjustment(lot, -7), e => e.code === 'INSUFFICIENT_UNRESERVED_STOCK' && /retirar 6 piezas/.test(e.message))
  assert.throws(() => validateInventoryAdjustment({ onHandQty: 4, reservedQty: 4 }, -1), /retirar 0 piezas/)
  assert.throws(() => validateInventoryAdjustment(lot, 0), /distinto de cero/)
  assert.throws(() => validateInventoryAdjustment({ onHandQty: 2147483647, reservedQty: 0 }, 1), /agregar 0 piezas/)
})

test('servidor relee el saldo después del bloqueo y rechaza un ajuste antes válido', async () => {
  const lot = { onHandQty: 10, reservedQty: 4 }, order = []
  assert.doesNotThrow(() => validateInventoryAdjustment(lot, -6))
  const tx = {
    async $queryRaw(strings) {
      if (strings.join('').includes('FOR UPDATE')) { order.push('lock'); lot.reservedQty = 9 }
      return [{ id: 'admin' }]
    },
    inventoryMovement: { findUnique: async () => null, create: async () => { throw Error('No debe guardar el movimiento') } },
    inventoryLot: { findUnique: async () => { order.push('read'); return lot } },
  }
  await assert.rejects(withInventoryTransaction({ $transaction: callback => callback(tx) }, context => adjustInventory(context, { lotId: 'lot', delta: -6, reason: 'Ajuste sintético', actorId: 'admin', idempotencyKey: 'fixture' })), /retirar 1 pieza/)
  assert.deepEqual(order, ['lock', 'read'])
})

test('reintento de ajuste ya registrado conserva idempotencia sin aplicar otra salida', async () => {
  const previous = { id: 'movement', kind: 'ADJUSTMENT', actorId: 'admin', lotId: 'lot', onHandDelta: -2, reason: 'Fixture' }
  const tx = { $queryRaw: async () => [{ id: 'admin' }], inventoryMovement: { findUnique: async () => previous }, inventoryLot: { findUnique: () => { throw Error('No debe reaplicar el ajuste') } } }
  const result = await withInventoryTransaction({ $transaction: callback => callback(tx) }, context => adjustInventory(context, { lotId: 'lot', delta: -2, reason: 'Fixture', actorId: 'admin', idempotencyKey: 'fixture' }))
  assert.equal(result, previous)
})
