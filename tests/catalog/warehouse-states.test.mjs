import test from 'node:test'
import assert from 'node:assert/strict'
import { mexicanStates, isMexicanStateCode } from '../../shared/features/shipping/mexican-states.js'
import { rateAddress } from '../../server/features/shipping/envia-rates.js'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'

test('catálogo de 32 estados tiene códigos únicos compatibles con las direcciones de Envia', () => {
  assert.equal(mexicanStates.length, 32)
  assert.equal(new Set(mexicanStates.map(state => state.value)).size, 32)
  for (const state of mexicanStates) {
    assert.equal(isMexicanStateCode(state.value), true)
    assert.equal(rateAddress({ country: 'MX', state: state.value, postalCode: '01000', name: 'Fixture', phone: '0000000000', street: 'Fixture 1', city: 'Fixture' }).state, state.value)
  }
  assert.equal(mexicanStates.find(state => state.label === 'San Luis Potosí').value, 'SL')
  assert.equal(mexicanStates.find(state => state.label === 'Ciudad de México').value, 'CX')
  for (const value of ['ZZ', 'SLP', 'CDMX', 'sl', '', null, {}, ['SL']]) assert.equal(isMexicanStateCode(value), false)
})

test('alta de almacén guarda el código seleccionado y rechaza códigos desconocidos antes de escribir', async () => {
  const adminId = '00000000-0000-4000-8000-000000000001'
  let saved, demoInitializations = 0, historyInitializations = 0
  const service = createStoreAdministration({ $transaction: run => run({
    $queryRaw: async sql => { if (sql.join('').includes('initialize_demo_catalog_stock')) { assert.ok(saved); demoInitializations++; return [{ created: 0 }] } if (sql.join('').includes('initialize_demo_customers_orders_reviews')) { assert.ok(saved); historyInitializations++; return [{ created: 0 }] } return [] },
    user: { findUnique: async () => ({ id: adminId, role: 'ADMIN', deletedAt: null }) },
    warehouse: { findUnique: async () => null, create: async ({ data }) => { saved = data; return { id: adminId, ...data } } },
    auditEvent: { create: async () => ({}) },
  }) })
  const input = { name: 'Fixture', recipientName: 'Fixture', contactName: 'Fixture', phone: '0000000000', postalCode: '01000', state: 'SL', city: 'Fixture', district: 'Fixture', street: 'Fixture', exteriorNumber: '1', reason: 'Prueba sin persistencia' }
  for (const state of ['ZZ', 'SLP', 'CDMX']) await assert.rejects(service.configureWarehouse(adminId, { ...input, state }), error => error.status === 400)
  assert.equal(saved, undefined)
  assert.equal(demoInitializations, 0)
  await service.configureWarehouse(adminId, input)
  assert.equal(saved.state, 'SL')
  assert.equal(demoInitializations, 1)
  assert.equal(historyInitializations, 1)
})
