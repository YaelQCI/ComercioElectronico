import test from 'node:test'
import assert from 'node:assert/strict'
import { parseServings } from '../../shared/features/catalog/servings.js'

test('porciones opcionales y decimales positivos dentro de la precisión de la base', () => {
  for (const value of [undefined, null, '']) assert.equal(parseServings(value), null)
  for (const value of ['30', '30.5', '0.0001', '9999999999.9999']) assert.equal(parseServings(value), value)
  for (const value of ['0', '0.0000', '-1', '1.00001', '10000000000', '3,5', '1e2', 'desconocido', 30, {}, ' ']) assert.throws(() => parseServings(value), RangeError)
})
