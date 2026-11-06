import test from 'node:test'
import assert from 'node:assert/strict'
import { uniqueConstraintMatches } from '../../server/utils/unique-constraint.js'
import { catalogDuplicateMessage } from '../../server/features/catalog/duplicate-records.js'

test('unicidad reconoce columnas e índices del adaptador pg sin interpretar SQL', () => {
  for (const meta of [{ target: ['sku'] }, { target: 'ProductVariant_sku_key' }, { driverAdapterError: { cause: { constraint: { index: 'ProductVariant_sku_key' } } } }, { driverAdapterError: { cause: { constraint: { fields: ['sku'] } } } }]) {
    assert.equal(uniqueConstraintMatches({ code: 'P2002', meta }, ['sku'], 'ProductVariant_sku_key'), true)
  }
  assert.equal(uniqueConstraintMatches({ code: 'P2003', meta: { target: ['sku'] } }, ['sku'], 'ProductVariant_sku_key'), false)
  assert.equal(uniqueConstraintMatches({ code: 'P2002', meta: { target: ['id', 'sku'] } }, ['sku'], 'ProductVariant_sku_key'), false)
})
test('duplicados identifican el campo exacto y ofrecen una acción sin revelar datos privados', () => {
  const error = index => ({ code: 'P2002', message: 'SQL y datos privados no deben mostrarse', meta: { driverAdapterError: { cause: { constraint: { index } } } } })
  for (const [index, entity, match] of [
    ['ProductVariant_sku_key', 'product', /SKU: ya está registrado/],
    ['Product_slug_key', 'product', /URL del producto: ya está registrado/],
    ['Category_slug_key', 'category', /URL de la categoría: ya está registrado/],
    ['Brand_slug_key', 'brand', /Identificador de marca: ya está registrado/],
    ['ProductVariant_productId_flavorNormalized_presentationNorma_key', 'product', /Sabor y presentación: esa combinación ya existe/],
  ]) {
    const message = catalogDuplicateMessage(error(index), entity)
    assert.match(message, match)
    assert.doesNotMatch(message, /SQL|privados/)
  }
  assert.match(catalogDuplicateMessage(error('Otra_restriccion')), /Actualiza la lista/)
})
