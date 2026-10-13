import test from 'node:test'
import assert from 'node:assert/strict'
import { bundleSummary } from '../../shared/features/catalog/bundles.js'
const bundle = () => ({ id: 'fixture', code: 'FIXTURE', name: 'Sintético', compositionVersion: 1, priceCents: '2501', components: [{ variantId: 'a', quantity: 1, unitPriceCents: '1000', servings: '10', valid: true, lots: [{ onHandQty: 8, reservedQty: 1, warehouse: { timezone: 'UTC' } }] }, { variantId: 'b', quantity: 2, unitPriceCents: '1000', servings: '0.5', valid: true, lots: [{ onHandQty: 5, reservedQty: 0, warehouse: { timezone: 'UTC' } }] }] })
test('combo obtiene componente limitante, porciones documentadas y asignación exacta de centavos', () => {
  const result = bundleSummary(bundle())
  assert.equal(result.availableQty, 2); assert.equal(result.servings, '11'); assert.equal(result.savingCents, '499')
  assert.equal(result.components.reduce((n, c) => n + BigInt(c.allocatedPriceCents), 0n), 2501n)
})
test('combo oculto, componente inválido o sin precios de referencia no se ofrece', () => {
  const hidden = bundle(); hidden.components[0].valid = false
  assert.equal(bundleSummary(hidden), null)
  const noReference = bundle(); noReference.components.forEach(c => { c.unitPriceCents = '0' })
  assert.equal(bundleSummary(noReference), null)
})
test('porciones incompletas no se inventan y lote vencido no aporta disponibilidad', () => {
  const input = bundle(); input.components[0].servings = null; input.components[1].lots[0].expiresOn = '2020-01-01'
  const result = bundleSummary(input)
  assert.equal(result.servings, null); assert.equal(result.availableQty, 0)
})
