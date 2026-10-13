import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { importCatalog } from '../../server/features/catalog/import-catalog.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar únicamente TEST_DATABASE_URL aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
const resolveAsset = async () => ({ mimeType: 'image/webp', byteSize: '100', checksum: '0'.repeat(64) })
async function input() {
  const warehouse = await db.warehouse.findFirst()
  assert.ok(warehouse, 'Ejecutar fixtures de migración en esta base aislada antes de esta prueba.')
  const slug = `fixture-${randomUUID()}`
  return { version: 1, products: [{ slug, name: 'Fixture de importación', description: 'Datos sintéticos exclusivamente de prueba', categories: [{ slug: 'fixture-import', name: 'Categoría sintética' }], images: [{ path: `/images/catalog/${slug}.webp`, alt: 'Fixture', kind: 'FRONT' }], variants: [{ sku: slug.toUpperCase(), flavor: 'Neutro', presentationLabel: 'Fixture', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100, lots: [{ warehouseId: warehouse.id, lotCode: 'FIXTURE', initialQty: 3, expiresOn: '2030-01-31', expiryPrecision: 'MONTH' }] }] }] }
}
test('importa catálogo en PostgreSQL y recepción inicial mediante ledger; borrador no publicado', async () => {
  const data = await input()
  const result = await importCatalog(db, data, { resolveAsset })
  assert.equal(result.importedProducts, 1)
  const saved = await db.product.findUnique({ where: { id: result.productIds[0] }, include: { productVariant_product: { include: { inventoryLot_variant: { include: { inventoryMovement_lot: true } } } }, productCategory_product: true, productMedia_product: true } })
  assert.equal(saved.publishedAt, null)
  assert.equal(saved.productVariant_product[0].priceCents, 1000n)
  const lot = saved.productVariant_product[0].inventoryLot_variant[0]
  assert.equal(lot.onHandQty, 3)
  assert.equal(lot.inventoryMovement_lot.length, 1)
  assert.equal(saved.productCategory_product.length, 1)
  assert.equal(saved.productMedia_product.length, 1)
  assert.equal(await createCatalogRepository(db).getById(saved.id), null)
})
test('conflicto de SKU al final aborta productos, taxonomía, medios y stock de todo el lote', async () => {
  const first = await input()
  await importCatalog(db, first, { resolveAsset })
  const next = await input()
  const conflicting = structuredClone(first.products[0]); conflicting.slug = `fixture-${randomUUID()}`
  next.products.push(conflicting)
  const before = await db.product.count()
  await assert.rejects(importCatalog(db, next, { resolveAsset }))
  assert.equal(await db.product.count(), before)
  assert.equal(await db.product.findUnique({ where: { slug: next.products[0].slug } }), null)
  assert.equal(await db.mediaAsset.findUnique({ where: { storageKey: next.products[0].images[0].path } }), null)
})
test('recurso faltante evita iniciar escrituras', async () => {
  const data = await input(), before = await db.product.count()
  await assert.rejects(importCatalog(db, data, { resolveAsset: async () => { throw new Error('Archivo faltante') } }))
  assert.equal(await db.product.count(), before)
})
