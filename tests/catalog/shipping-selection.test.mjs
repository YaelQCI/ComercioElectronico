import test from 'node:test'
import assert from 'node:assert/strict'
import { hasCurrentShippingQuote } from '../../app/features/checkout/shipping-selection.js'
const now = Date.parse('2026-10-15T12:00:00Z')
const quote = { id: 'fixture', cartVersion: 3, quotedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 10000).toISOString() }
test('requiere selección para el carrito actual y dentro de la vigencia', () => {
  assert.equal(hasCurrentShippingQuote(quote, 3, now), true)
  for (const value of [null, {}, { ...quote, id: '' }, { ...quote, cartVersion: 2 }, { ...quote, quotedAt: 'inválida' }, { ...quote, quotedAt: new Date(now + 1).toISOString() }, { ...quote, quotedAt: new Date(now - 600001).toISOString() }, { ...quote, expiresAt: new Date(now).toISOString() }, { ...quote, expiresAt: 'inválida' }]) assert.equal(hasCurrentShippingQuote(value, 3, now), false)
  assert.equal(hasCurrentShippingQuote({ ...quote, expiresAt: null, quotedAt: new Date(now - 600000).toISOString() }, 3, now), true)
})
