import test from 'node:test'
import assert from 'node:assert/strict'
import { paginateCatalog, sortCatalog, parseCatalogPage } from '../../shared/features/catalog/pagination.js'
import { filterProducts, parseCatalogFilters } from '../../shared/features/catalog/filters.js'
const make = (id, cents = '1000', servings = '3') => ({ id, name: `Producto ${id}`, categories: [], facets: [], variants: [{ id: `v-${id}`, sku: `SKU-${id}`, priceCents: cents, servings, presentationLabel: 'Fixture', availableQty: 1 }], publishedAt: '2026-01-01T00:00:00.000Z', featuredPosition: null })
test('48 productos son 4 páginas de 12 y extremos se corrigen sin vacío falso', () => {
  const products = Array.from({ length: 48 }, (_, i) => make(String(i).padStart(2, '0')))
  const first = paginateCatalog(products)
  assert.equal(first.pages, 4); assert.equal(first.start, 1); assert.equal(first.end, 12)
  const last = paginateCatalog(products, { page: 999 })
  assert.equal(last.page, 4); assert.equal(last.start, 37); assert.equal(last.end, 48)
  assert.equal(last.products.length, 12)
  assert.deepEqual(paginateCatalog([], { page: 9 }), { products: [], total: 0, pages: 0, page: 1, pageSize: 12, start: 0, end: 0, order: 'relevancia' })
  for (const pagina of ['0', '-1', 'abc', '1.5', ['2'], '99999999999']) assert.equal(parseCatalogPage({ pagina }).page, 1)
  assert.throws(() => parseCatalogPage({ orden: 'otro' }))
})
test('orden estable por UUID y precios exactos, sin redondear porciones', () => {
  const products = [make('c', '1000'), make('b', '999'), make('a', '999'), make('d', '1', null)]
  assert.deepEqual(sortCatalog(products, 'precio-asc').map(p => p.id), ['d', 'a', 'b', 'c'])
  assert.deepEqual(sortCatalog(products, 'porcion-desc').map(p => p.id), ['c', 'a', 'b', 'd'])
  assert.deepEqual(sortCatalog(products.reverse(), 'porcion-asc').map(p => p.id), ['a', 'b', 'c', 'd'])
})
test('relevancia privilegia SKU exacto y novedades usa publicación', () => {
  const a = make('a'), b = { ...make('b'), name: 'SKU-a', publishedAt: '2026-02-01T00:00:00.000Z' }
  assert.deepEqual(sortCatalog([b, a], 'relevancia', 'sku-A').map(p => p.id), ['a', 'b'])
  assert.deepEqual(sortCatalog([a, b], 'novedades').map(p => p.id), ['b', 'a'])
})
test('precio mostrado/ordenado proviene de variantes que cumplen filtros', () => {
  const product = make('a', '1000')
  product.variants.push({ ...product.variants[0], id: 'v2', priceCents: '5000' })
  const filtered = filterProducts([product], parseCatalogFilters({ precioMin: '40' }))
  assert.equal(filtered[0].variants.length, 1)
  assert.equal(filtered[0].variants[0].priceCents, '5000')
  assert.equal(product.variants.length, 2)
})
