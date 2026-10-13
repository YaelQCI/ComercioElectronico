import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateUnitDemand, planFEFO } from '../../shared/features/inventory/fefo.js'
test('demanda agrega SKU de componentes sueltos y combos antes de reservar', () => {
  assert.deepEqual(aggregateUnitDemand([{ id: 'solo', variantId: 'a' }, { id: 'combo1', variantId: 'a' }, { id: 'combo2', variantId: 'b' }]), [{ variantId: 'a', quantity: 2 }, { variantId: 'b', quantity: 1 }])
  assert.throws(() => aggregateUnitDemand([{ id: 'a', variantId: 'a' }, { id: 'a', variantId: 'a' }]))
})
test('una demanda puede usar varios lotes FEFO y no sobrepasa disponibilidad', () => {
  const base = { isBlocked: false, reservedQty: 0, warehouse: { timezone: 'America/Mexico_City' }, createdAt: '2026-01-01' }
  const lots = [{ ...base, id: 'later', expiresOn: '2030-01-31', onHandQty: 5 }, { ...base, id: 'first', expiresOn: '2029-01-31', onHandQty: 2 }]
  const plan = planFEFO(4, lots, new Date('2026-10-13T18:00:00Z'))
  assert.deepEqual(plan.map(p => [p.lot.id, p.quantity]), [['first', 2], ['later', 2]])
  assert.throws(() => planFEFO(8, lots, new Date('2026-10-13T18:00:00Z')), e => e.code === 'INSUFFICIENT_STOCK')
})
