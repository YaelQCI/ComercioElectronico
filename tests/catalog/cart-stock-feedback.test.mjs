import test from 'node:test'
import assert from 'node:assert/strict'
import { canSetQuantity, limitedQuantity, stockMessage, stockChangeNotice } from '../../app/features/cart/stock-feedback.js'
const line = { name: 'Artículo sintético', valid: true, quantity: 5, availableQty: 3, maxQuantity: 3, stockSufficient: false }
test('limita cantidades al máximo y explica el exceso sin cambiar la selección guardada', () => {
  assert.equal(limitedQuantity(line, 5), '3')
  assert.equal(limitedQuantity(line, '999'), '3')
  assert.equal(limitedQuantity(line, ''), '')
  assert.equal(limitedQuantity(line, '-2'), '1')
  assert.equal(limitedQuantity(line, '2.5'), '2')
  assert.equal(limitedQuantity(line, 'inválido'), '')
  assert.equal(canSetQuantity(line), true)
  assert.match(stockMessage(line), /5 piezas.*máximo.*3/)
  assert.match(stockChangeNotice(line), /Artículo sintético/)
  assert.equal(line.quantity, 5)
})
test('distingue agotado, producto no disponible y existencias compartidas con combos', () => {
  const empty = { ...line, availableQty: 0, maxQuantity: 0 }
  assert.equal(canSetQuantity(empty), false)
  assert.equal(limitedQuantity(empty, 1), '')
  assert.match(stockMessage(empty), /Por el momento no hay existencias/)
  assert.match(stockMessage({ ...empty, valid: false }), /ya no está disponible para comprar/)
  assert.match(stockMessage({ ...line, maxQuantity: 0 }), /otras líneas o combos/)
  assert.equal(stockMessage({ ...line, quantity: 2, stockSufficient: true }), '')
})
