import test from 'node:test'
import assert from 'node:assert/strict'
import { postalCode, shippingProgress } from '../../shared/features/shipping/shipping-policy.js'
import { choosePackage } from '../../shared/features/shipping/pack-order.js'
const item = (overrides = {}) => ({ variantId: 'a', quantity: 1, weightGrams: 200, lengthMm: 100, widthMm: 100, heightMm: 100, ...overrides })
const box = (overrides = {}) => ({ id: 'fixture', code: 'FIXTURE', version: 1, isActive: true, innerLengthMm: 200, innerWidthMm: 200, innerHeightMm: 200, outerLengthMm: 210, outerWidthMm: 210, outerHeightMm: 210, tareWeightGrams: 100, ...overrides })
test('CP conserva ceros y umbral usa centavos exactos antes de puntos', () => {
  assert.equal(postalCode('01234'), '01234')
  for (const value of [1234, '1234', '123456', '12a45']) assert.throws(() => postalCode(value))
  assert.equal(shippingProgress('149899', '15000').chargedAmountCents, '15000')
  assert.equal(shippingProgress('149899').remainingCents, '1')
  assert.equal(shippingProgress('149900', '15000').chargedAmountCents, '0')
  assert.equal(shippingProgress('149901', '15000').subsidyCents, '15000')
  assert.equal(shippingProgress('149900').chargedAmountCents, null)
})
test('empaque usa peso bruto, rotaciones, cantidades y una sola caja', () => {
  const result = choosePackage([item({ quantity: 8 })], [box()])
  assert.equal(result.grossWeightGrams, 1700); assert.equal(result.lengthMm, 210)
  assert.equal(result.placements.reduce((sum, p) => sum + p.quantity, 0), 8)
  assert.throws(() => choosePackage([item({ quantity: 9 })], [box()]), /caja apta/)
  assert.throws(() => choosePackage([item()], [box({ maxGrossWeightGrams: 250 })]), /caja apta/)
  assert.equal(choosePackage([item({ lengthMm: 180, widthMm: 80, heightMm: 80 })], [box({ innerLengthMm: 100, innerWidthMm: 200, innerHeightMm: 100 })]).placements.length, 1)
})
test('volumen suficiente no prueba ajuste geométrico y no hay tope comercial de piezas', () => {
  assert.throws(() => choosePackage([item({ lengthMm: 250, widthMm: 20, heightMm: 20 })], [box()]), /caja apta/)
  const result = choosePackage([item({ quantity: 1000, weightGrams: 1, lengthMm: 10, widthMm: 10, heightMm: 10 })], [box()])
  assert.equal(result.placements.reduce((sum, p) => sum + p.quantity, 0), 1000)
  assert.throws(() => choosePackage([item({ lengthMm: null })], [box()]), /medidas/)
})
test('bloques de distintos SKU no se superponen y se mantienen dentro de caja', () => {
  const result = choosePackage([item({ quantity: 3 }), item({ variantId: 'b', quantity: 2 })], [box()])
  const blocks = result.placements.map(p => ({ origin: p.positionMm, size: p.unitDimensionsMm.map((n,i) => n * p.grid[i]) }))
  for (const block of blocks) block.origin.forEach((n,i) => assert.ok(n >= 0 && n + block.size[i] <= 200))
  for (let i = 0; i < blocks.length; i++) for (let j = i+1; j < blocks.length; j++) assert.ok([0,1,2].some(axis => blocks[i].origin[axis] + blocks[i].size[axis] <= blocks[j].origin[axis] || blocks[j].origin[axis] + blocks[j].size[axis] <= blocks[i].origin[axis]))
})
