import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCatalogManifest, CatalogValidationError } from '../../server/features/catalog/catalog-manifest.js'

export function fixture() {
  return { version: 1, products: [{ slug: 'fixture-no-comercial', name: 'Fixture sintética', description: 'Solo prueba, no se importa como catálogo real', categories: [{ slug: 'aminoacidos', name: 'Aminoácidos' }], goals: [{ slug: 'fixture', name: 'Fixture' }], images: [{ path: '/images/catalog/fixture.webp', alt: 'Imagen sintética', kind: 'FRONT' }], variants: [{ sku: 'FIXTURE', flavor: 'Sin sabor', presentationLabel: '100 g', contentAmount: '100', contentUnit: 'g', servings: '20', priceCents: '12345', weightGrams: 120, lengthMm: 100, widthMm: 100, heightMm: 100, lots: [] }] }] }
}
test('validación es estable y conserva objetivos al volver a validar; borrador por defecto', () => {
  const parsed = validateCatalogManifest(fixture())
  assert.equal(parsed.products[0].publish, false)
  assert.equal(parsed.products[0].facets[0].kind, 'GOAL')
  assert.deepEqual(validateCatalogManifest(parsed), parsed)
})
test('rechaza datos mínimos faltantes, duplicados y entradas comerciales inválidas', () => {
  const changes = [
    m => { m.products = [] },
    m => { m.products[0].publish = 'sí' },
    m => { m.products.push(structuredClone(m.products[0])) },
    m => { m.products[0].variants.push(structuredClone(m.products[0].variants[0])) },
    m => { m.products[0].variants[0].priceCents = '1.20' },
    m => { m.products[0].variants[0].priceCents = '-1' },
    m => { m.products[0].variants[0].servings = '0' },
    m => { m.products[0].variants[0].weightGrams = 0 },
    m => { m.products[0].variants[0].widthMm = 0 },
    m => { m.products[0].images[0].path = '/images/catalog/../secret.webp' },
    m => { m.products[0].images[0].path = 'javascript:alert(1)' },
    m => { m.products[0].images[0].alt = '' },
    m => { m.products[0].images[0].variantSku = 'OTRO' },
    m => { m.products[0].categories.push({ slug: 'aminoacidos', name: 'Otro nombre' }) },
    m => { m.products[0].variants[0].nutritionData = [] },
  ]
  for (const change of changes) { const input = fixture(); change(input); assert.throws(() => validateCatalogManifest(input), CatalogValidationError) }
})
test('valida fechas de lotes y precisión mensual, acepta múltiples lotes por SKU', () => {
  const input = fixture()
  const lot = { warehouseId: '00000000-0000-4000-8000-000000000001', lotCode: 'FIX-1', expiresOn: '2028-02-29', expiryPrecision: 'MONTH', initialQty: 2 }
  input.products[0].variants[0].lots = [lot, { ...lot, lotCode: 'FIX-2', expiresOn: '2028-03-31' }]
  assert.equal(validateCatalogManifest(input).products[0].variants[0].lots.length, 2)
  lot.expiresOn = '2027-02-29'
  assert.throws(() => validateCatalogManifest(input), CatalogValidationError)
  lot.expiresOn = '2028-02-20'
  assert.throws(() => validateCatalogManifest(input), CatalogValidationError)
  lot.expiryPrecision = 'DAY'
  assert.doesNotThrow(() => validateCatalogManifest(input))
  lot.initialQty = -1
  assert.throws(() => validateCatalogManifest(input), CatalogValidationError)
})
test('combinación sabor/presentación única tras normalización', () => {
  const input = fixture(), v = input.products[0].variants[0]
  input.products[0].variants.push({ ...v, sku: 'FIXTURE-2', flavor: ' SIN SABOR ', presentationLabel: '100 G' })
  assert.throws(() => validateCatalogManifest(input), CatalogValidationError)
})
