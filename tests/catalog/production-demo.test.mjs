import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'

test('producción configura el almacén sin inicializar stock, clientes ni pedidos DEMO', async () => {
  const id = '10000000-0000-4000-8000-000000000001'
  const input = { name: 'Fixture', recipientName: 'Fixture', phone: '0000000000', postalCode: '00000', state: 'SL', city: 'Fixture', district: 'Fixture', street: 'Fixture', exteriorNumber: '1', contactName: 'Fixture', reason: 'Prueba sintética' }
  for (const demoDataEnabled of [false, true]) {
    const queries = []
    const tx = {
      $queryRaw: async query => { queries.push(query.join('')); return [{ created: 0 }] },
      user: { findUnique: async () => ({ id, role: 'ADMIN', deletedAt: null }) },
      warehouse: { findUnique: async () => null, create: async () => ({ id, name: input.name }) },
      auditEvent: { create: async () => ({}) },
    }
    const db = { $transaction: operation => operation(tx) }
    await createStoreAdministration(db, { demoDataEnabled }).configureWarehouse(id, input)
    assert.equal(queries.some(query => query.includes('initialize_demo_catalog_stock')), demoDataEnabled)
    assert.equal(queries.some(query => query.includes('initialize_demo_customers_orders_reviews')), demoDataEnabled)
  }
})
