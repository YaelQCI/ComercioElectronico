import test from 'node:test'
import assert from 'node:assert/strict'
import { createDraftIdentifierCheck } from '../../app/features/administration/draft-identifier-check.js'

test('una respuesta anterior no reemplaza el resultado de los identificadores actuales', async () => {
  const waiting = [], states = []
  const checker = createDraftIdentifierCheck(() => new Promise(resolve => waiting.push(resolve)), state => states.push(state))
  const old = checker.check({ slug: 'anterior' }), current = checker.check({ slug: 'actual' })
  waiting[1]({ slugExists: false, skuExists: false }); await current
  waiting[0]({ slugExists: true, skuExists: true }); assert.equal(await old, null)
  assert.equal(states.length, 1)
  assert.equal(states[0].result.slugExists, false)
})

test('invalidar descarta resultados pendientes y un fallo no afirma disponibilidad', async () => {
  let resolve, fail = false
  const states = [], checker = createDraftIdentifierCheck(() => fail ? Promise.reject(Error('Sin conexión')) : new Promise(done => { resolve = done }), state => states.push(state))
  const old = checker.check({ sku: 'ANTERIOR' })
  checker.invalidate(); resolve({ skuExists: true }); assert.equal(await old, null); assert.equal(states.length, 0)
  fail = true
  assert.equal(await checker.check({ sku: 'ACTUAL' }), null)
  assert.equal(states[0].result, null)
  assert.ok(states[0].failure.includes('Reintenta'))
})
