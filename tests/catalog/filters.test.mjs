import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCatalogFilters, filterProducts } from '../../shared/features/catalog/filters.js'
import { availableFromLots } from '../../shared/features/inventory/availability.js'
const product = { id: 'fixture', categories: [{ slug: 'proteina' }], facets: [{ kind: 'GOAL', slug: 'fuerza' }], variants: [{ priceCents: '3000', servings: '2', presentationLabel: '100 g', availableQty: 3 }, { priceCents: '6001', servings: '2', presentationLabel: '200 g', availableQty: 0 }] }
test('OR dentro del grupo, AND entre grupos y misma variante para filtros de presentación/precio/stock', () => {
  assert.equal(filterProducts([product], parseCatalogFilters({ categoria: ['creatina', 'proteina'], objetivo: 'fuerza', stock: 'disponible' })).length, 1)
  assert.equal(filterProducts([product], parseCatalogFilters({ categoria: 'proteina', objetivo: 'energia' })).length, 0)
  assert.equal(filterProducts([product], parseCatalogFilters({ presentacion: '200 g', stock: 'disponible' })).length, 0)
  assert.equal(filterProducts([product], parseCatalogFilters({ presentacion: '100 g', precioMin: '40' })).length, 0)
})
test('rangos por porción respetan límites exactos 15/30 sin redondear', () => {
  for (const [cents, bucket] of [['2999', 'menos-15'], ['3000', '15-30'], ['6000', '15-30'], ['6001', 'mas-30']]) {
    const p = { ...product, variants: [{ ...product.variants[0], priceCents: cents }] }
    assert.equal(filterProducts([p], parseCatalogFilters({ porcion: bucket })).length, 1)
  }
})
test('valida precios en MXN, extremos y opciones desconocidas', () => {
  assert.equal(parseCatalogFilters({ precioMin: '15.50' }).minPriceCents, '1550')
  for (const bad of [{ precioMin: '-1' }, { precioMin: '30', precioMax: '15' }, { precioMax: '1.001' }, { stock: 'hoy' }, { porcion: 'otro' }, { categoria: {} }]) assert.throws(() => parseCatalogFilters(bad))
})
test('disponibilidad resta reservas, excluye bloqueados/vencidos y usa fecha local del almacén', () => {
  const lot = { onHandQty: 5, reservedQty: 2, nonSellableQty: 10, isBlocked: false, expiresOn: '2026-10-13T00:00:00Z', warehouse: { timezone: 'America/Mexico_City' } }
  const now = new Date('2026-10-14T03:00:00Z') // Todavía 13 en el almacén.
  assert.equal(availableFromLots([lot], now), 3)
  assert.equal(availableFromLots([{ ...lot, isBlocked: true }], now), 0)
  assert.equal(availableFromLots([{ ...lot, expiresOn: '2026-10-12' }], now), 0)
  assert.equal(availableFromLots([{ ...lot, expiresOn: null }], now), 3)
})
