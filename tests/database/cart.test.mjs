import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { importCatalog } from '../../server/features/catalog/import-catalog.js'
import { createCartRepository } from '../../server/features/cart/cart-repository.js'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar base aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
test.after(() => db.$disconnect())
const repository = createCartRepository(db)
const hash = () => randomBytes(32).toString('hex')
async function fixture() {
  const warehouse = await db.warehouse.findFirst(), slug = `cart-fixture-${randomUUID()}`
  const result = await importCatalog(db, { version: 1, products: [{ slug, name: 'Carrito sintético', description: 'Exclusivamente pruebas', publish: true, images: [{ path: '/images/catalog/cart-fixture.webp', alt: 'Prueba', kind: 'FRONT' }], categories: [{ slug: 'cart-fixture', name: 'Carrito sintético' }], variants: ['A', 'B'].map(suffix => ({ sku: `${slug}-${suffix}`.toUpperCase(), flavor: suffix, presentationLabel: 'Fixture', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100, lots: [{ warehouseId: warehouse.id, lotCode: suffix, initialQty: 12, expiresOn: '2030-01-31', expiryPrecision: 'MONTH' }] })) }] }, { resolveAsset: async () => ({ mimeType: 'image/webp', byteSize: '100', checksum: '0'.repeat(64) }) })
  return db.productVariant.findMany({ where: { productId: result.productIds[0] }, orderBy: { sku: 'asc' } })
}
test('consolida SKU, separa variantes, persiste, no reserva y aísla propietarios', async () => {
  const variants = await fixture(), owner = hash()
  const first = await repository.add(owner, { variantId: variants[0].id, quantity: 7, version: 1 })
  const second = await repository.add(owner, { variantId: variants[0].id, quantity: 4, version: first.version })
  const third = await repository.add(owner, { variantId: variants[1].id, quantity: 1, version: second.version })
  assert.equal(third.products, 2); assert.equal(third.pieces, 12)
  assert.equal(third.totals.goodsMoneyCents, '12000')
  assert.deepEqual(await repository.read(owner), third)
  assert.equal((await repository.read(hash())).pieces, 0)
  const lots = await db.inventoryLot.findMany({ where: { variantId: { in: variants.map(v => v.id) } } })
  assert.ok(lots.every(l => l.reservedQty === 0 && l.onHandQty === 12))
  await assert.rejects(repository.add(owner, { variantId: variants[0].id, quantity: 2, version: third.version }), /stock/)
  assert.equal((await repository.read(owner)).pieces, 12)
})
test('dos peticiones con misma versión solo agregan una vez; entradas inválidas no escriben', async () => {
  const [variant] = await fixture(), owner = hash()
  const results = await Promise.allSettled([1, 2].map(() => repository.add(owner, { variantId: variant.id, quantity: 1, version: 1 })))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal((await repository.read(owner)).pieces, 1)
  await assert.rejects(repository.add(owner, { variantId: variant.id, quantity: 1.5, version: 2 }), /inválida/)
  await assert.rejects(repository.add(owner, null), /inválida/)
})
test('lectura revalida precio y publicación; demanda de combo y unidad se suma', async () => {
  const [variant] = await fixture(), owner = hash()
  await repository.add(owner, { variantId: variant.id, quantity: 1, version: 1 })
  await db.productVariant.update({ where: { id: variant.id }, data: { priceCents: 2000n } })
  assert.equal((await repository.read(owner)).totals.goodsMoneyCents, '2000')
  const cart = await db.cart.findUnique({ where: { guestTokenHash: owner } })
  const bundle = await db.bundle.create({ data: { code: `FIXTURE-${randomUUID()}`, slug: `fixture-${randomUUID()}`, name: 'Combo sintético', priceCents: 3000n, bundleComponent_bundle: { create: { variantId: variant.id, quantity: 2 } } } })
  await db.cartItem.create({ data: { cartId: cart.id, bundleId: bundle.id, quantity: 5 } })
  await assert.rejects(repository.add(owner, { variantId: variant.id, quantity: 2, version: 2 }), /stock/)
  await db.product.update({ where: { id: variant.productId }, data: { publishedAt: null } })
  const snapshot = await repository.read(owner)
  assert.ok(snapshot.lines.every(l => !l.valid && !l.stockSufficient))
})
