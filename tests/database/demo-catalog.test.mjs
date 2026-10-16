import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { demoCatalog } from '../../server/features/catalog/demo-catalog.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
const slugs = demoCatalog.map(product => product.slug)

test('migración: cuatro artículos de demostración por categoría, publicados y con imágenes locales íntegras', async () => {
  const products = await db.product.findMany({ where: { slug: { in: slugs } }, include: { brand: true, productCategory_product: { include: { category: true } }, productVariant_product: { include: { inventoryLot_variant: true } }, productMedia_product: { include: { asset: true } }, productRelation_sourceProduct: true } })
  assert.equal(products.length, 28)
  const counts = {}
  const catalog = createCatalogRepository(db)
  for (const product of products) {
    const expected = demoCatalog.find(item => item.slug === product.slug)
    assert.ok(product.publishedAt); assert.equal(product.deletedAt, null)
    assert.ok(product.name.includes('DEMO')); assert.ok(product.description.includes('DEMOSTRACIÓN'))
    assert.equal(product.brand.slug, 'tfs-demostracion-academica')
    assert.equal(product.ingredients, expected.ingredients); assert.equal(product.usageInstructions, expected.usageInstructions); assert.equal(product.allergenInformation, expected.allergenInformation)
    assert.equal(product.productCategory_product.length, 1)
    const category = product.productCategory_product[0]
    assert.equal(category.category.slug, expected.categorySlug); assert.equal(category.isPrimary, true)
    counts[expected.categorySlug] = (counts[expected.categorySlug] ?? 0) + 1
    assert.equal(product.productVariant_product.length, 1)
    const variant = product.productVariant_product[0]
    assert.equal(variant.sku, expected.sku); assert.equal(variant.priceCents.toString(), expected.priceCents)
    assert.equal(variant.contentAmount.toString(), expected.contentAmount); assert.equal(variant.servings?.toString() ?? null, expected.servings)
    assert.deepEqual(variant.nutritionData, expected.nutritionData)
    const initialLot = variant.inventoryLot_variant.find(lot => lot.lotCode === 'DEMO-INICIAL-01')
    assert.ok(initialLot, 'La migración posterior agrega stock DEMO cuando existe almacén')
    assert.ok(variant.inventoryLot_variant.every(lot => lot.certificateAssetId === null))
    assert.equal(product.productRelation_sourceProduct.length, 2)
    const image = product.productMedia_product[0]
    assert.equal(image.kind, 'FRONT'); assert.equal(image.asset.storageKey, expected.imagePath)
    const bytes = await readFile(new URL(`../../public${expected.imagePath}`, import.meta.url))
    assert.equal(BigInt(bytes.length), image.asset.byteSize); assert.equal(createHash('sha256').update(bytes).digest('hex'), image.asset.checksum)
    assert.equal((await sharp(bytes).metadata()).format, 'webp')
    const visible = await catalog.getById(product.id)
    assert.ok(visible); assert.equal(visible.images[0].url, expected.imagePath)
    assert.equal(visible.variants[0].availableQty, initialLot.onHandQty)
  }
  assert.equal(Object.keys(counts).length, 7)
  assert.ok(Object.values(counts).every(count => count === 4))
  assert.equal(await db.auditEvent.count({ where: { action: 'INITIALIZE_DEMO_CATALOG' } }), 28)
})

test('migración repetida no duplica datos ni revierte edición, precio, imágenes o retiro del administrador', async () => {
  const first = await db.product.findUniqueOrThrow({ where: { slug: slugs[0] }, include: { productVariant_product: true } })
  const variant = first.productVariant_product[0]
  const totalProducts = await db.product.count(), totalAssets = await db.mediaAsset.count(), totalRelations = await db.productRelation.count()
  try {
    await db.product.update({ where: { id: first.id }, data: { name: 'Demo editada por administrador', ingredients: 'Contenido corregido', publishedAt: null } })
    await db.productVariant.update({ where: { id: variant.id }, data: { priceCents: 12345n, priceVersion: 2 } })
    const migration = await readFile(new URL('../../prisma/migrations/20261016040000_demo_catalog/migration.sql', import.meta.url), 'utf8')
    const statement = migration.replace(/^BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, '')
    await db.$executeRawUnsafe(statement); await db.$executeRawUnsafe(statement)
    assert.equal(await db.product.count(), totalProducts); assert.equal(await db.mediaAsset.count(), totalAssets); assert.equal(await db.productRelation.count(), totalRelations)
    const saved = await db.product.findUniqueOrThrow({ where: { id: first.id } })
    assert.equal(saved.name, 'Demo editada por administrador'); assert.equal(saved.ingredients, 'Contenido corregido'); assert.equal(saved.publishedAt, null)
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).priceCents, 12345n)
    assert.equal(await db.auditEvent.count({ where: { action: 'INITIALIZE_DEMO_CATALOG' } }), 28)
  } finally {
    await db.product.update({ where: { id: first.id }, data: { name: first.name, ingredients: first.ingredients, publishedAt: first.publishedAt } })
    await db.productVariant.update({ where: { id: variant.id }, data: { priceCents: variant.priceCents, priceVersion: variant.priceVersion } })
  }
})
