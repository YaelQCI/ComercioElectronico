import test from 'node:test'
import assert from 'node:assert/strict'
import { pesosToCents, centsToPesos } from '../../app/features/administration/price-input.js'

test('convierte pesos a centavos exactos sin redondear decimales', () => {
  for (const [pesos, cents] of [['150', '15000'], ['150.00', '15000'], ['0.29', '29'], ['12.5', '1250'], ['12,50', '1250'], ['0', '0'], ['0001.01', '101'], ['9999999999999.99', '999999999999999']]) {
    assert.equal(pesosToCents(pesos), cents)
    assert.equal(pesosToCents(centsToPesos(cents)), cents)
  }
})

test('muestra precios existentes con dos decimales y conserva el anterior vacío', () => {
  assert.equal(centsToPesos('15000'), '150.00')
  assert.equal(centsToPesos('1'), '0.01')
  assert.equal(centsToPesos('0'), '0.00')
  assert.equal(centsToPesos(null), '')
  assert.equal(centsToPesos(''), '')
})

test('rechaza fracciones de centavo, negativos, notación exponencial, miles e importes fuera de rango', () => {
  for (const value of ['', '-1', '1.001', '1e3', '1,500.00', '1.500,00', 'NaN', 'Infinity', '10000000000000.00']) assert.throws(() => pesosToCents(value), RangeError)
})
