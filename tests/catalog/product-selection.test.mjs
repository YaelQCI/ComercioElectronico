import test from 'node:test'
import assert from 'node:assert/strict'
import { selectedVariant, productQuantity, nutritionRows } from '../../shared/features/catalog/product-selection.js'
test('variante pertenece al producto; desconocida no se sustituye silenciosamente', () => {
  const product = { variants: [{ id: 'a' }, { id: 'b' }] }
  assert.equal(selectedVariant(product, null).id, 'a')
  assert.equal(selectedVariant(product, 'b').id, 'b')
  assert.equal(selectedVariant(product, 'otro'), null)
  assert.equal(selectedVariant(product, ['a']), null)
})
test('cantidad admite más de diez, valida enteros y resta demanda existente del SKU', () => {
  assert.equal(productQuantity('20', 30, 10), 20)
  for (const bad of ['0', '1.5', '-1', '01', 'abc', 21]) assert.throws(() => productQuantity(bad, 30, 10))
  assert.throws(() => productQuantity('1', 0))
})
test('información nutrimental solo muestra filas documentadas', () => {
  assert.deepEqual(nutritionRows({ rows: [{ name: 'Fixture', amount: '10', unit: 'g' }, { name: 'Incompleta' }] }), [{ id: '0', nutrient: 'Fixture', amount: '10 g' }])
  assert.deepEqual(nutritionRows(null), [])
})
