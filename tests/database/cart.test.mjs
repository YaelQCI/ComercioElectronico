import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { importCatalog } from '../../server/features/catalog/import-catalog.js'
import { createCartRepository } from '../../server/features/cart/cart-repository.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
import { createShippingQuotes } from '../../server/features/shipping/shipping-quotes.js'

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
test('carrito resuelve imágenes subidas, prefiere la frontal de variante y conserva las estáticas', async () => {
  const [variant] = await fixture(), owner = hash()
  const first = await repository.add(owner, { variantId: variant.id, quantity: 1, version: 1 })
  assert.equal(first.lines[0].image.url, '/images/catalog/cart-fixture.webp')
  const front = await db.productMedia.findFirst({ where: { productId: variant.productId, kind: 'FRONT' } })
  await db.mediaAsset.update({ where: { id: front.assetId }, data: { storageKey: `uploads/${randomUUID()}.webp` } })
  const uploaded = await repository.read(owner)
  assert.deepEqual(uploaded.lines[0].image, { url: `/api/catalog/images/${front.assetId}`, alt: 'Prueba' })
  const asset = await db.mediaAsset.create({ data: { storageKey: `uploads/${randomUUID()}.webp`, mimeType: 'image/webp', byteSize: 100n, checksum: '1'.repeat(64) } })
  await db.productMedia.create({ data: { productId: variant.productId, variantId: variant.id, assetId: asset.id, kind: 'FRONT', altText: 'Frontal de la variante' } })
  assert.deepEqual((await repository.read(owner)).lines[0].image, { url: `/api/catalog/images/${asset.id}`, alt: 'Frontal de la variante' })
  await db.mediaAsset.update({ where: { id: asset.id }, data: { storageKey: '/ruta-interna-no-publica.webp' } })
  assert.equal((await repository.read(owner)).lines[0].image, null)
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
test('editar y quitar revalidan propiedad, versión y stock; último producto produce vacío', async () => {
  const [variant] = await fixture(), owner = hash()
  const original = await repository.add(owner, { variantId: variant.id, quantity: 2, version: 1 })
  const id = original.lines[0].id
  await assert.rejects(repository.edit(hash(), { itemId: id, quantity: 3, version: 2 }), /Carrito/)
  await assert.rejects(repository.edit(owner, { itemId: id, quantity: 13, version: 2 }), /stock/)
  const edited = await repository.edit(owner, { itemId: id, quantity: 12, version: 2 })
  assert.equal(edited.pieces, 12); assert.equal(edited.totals.goodsMoneyCents, '12000')
  await assert.rejects(repository.edit(owner, { itemId: id, quantity: 1, version: 2 }), /cambió/)
  const empty = await repository.edit(owner, { itemId: id, version: edited.version }, true)
  assert.equal(empty.pieces, 0); assert.equal(empty.products, 0); assert.equal(empty.totals, null)
  assert.equal((await repository.read(owner)).lines.length, 0)
})
test('guardar excluye totales y persiste; restaurar consolida y revalida stock sin reservar', async () => {
  const [variant] = await fixture(), owner = hash()
  const first = await repository.add(owner, { variantId: variant.id, quantity: 5, version: 1 })
  const saved = await repository.move(owner, { itemId: first.lines[0].id, action: 'SAVE', version: first.version })
  assert.equal(saved.pieces, 0); assert.equal(saved.totals, null); assert.equal(saved.saved[0].quantity, 5)
  assert.deepEqual((await repository.read(owner)).saved, saved.saved)
  const active = await repository.add(owner, { variantId: variant.id, quantity: 8, version: saved.version })
  await assert.rejects(repository.move(owner, { itemId: saved.saved[0].id, action: 'RESTORE', version: active.version }), /stock/)
  assert.equal((await repository.read(owner)).saved[0].quantity, 5)
  const reduced = await repository.edit(owner, { itemId: active.lines[0].id, quantity: 7, version: active.version })
  const restored = await repository.move(owner, { itemId: saved.saved[0].id, action: 'RESTORE', version: reduced.version })
  assert.equal(restored.lines.length, 1); assert.equal(restored.pieces, 12); assert.equal(restored.saved.length, 0)
  const savedAgain = await repository.move(owner, { itemId: restored.lines[0].id, action: 'SAVE', version: restored.version })
  const empty = await repository.move(owner, { itemId: savedAgain.saved[0].id, action: 'REMOVE', version: savedAgain.version })
  assert.equal(empty.saved.length, 0); assert.equal(empty.pieces, 0)
  assert.ok((await db.inventoryLot.findMany({ where: { variantId: variant.id } })).every(l => l.reservedQty === 0))
})
test('guardados despublicados permanecen visibles pero restauración rechazada', async () => {
  const [variant] = await fixture(), owner = hash()
  const added = await repository.add(owner, { variantId: variant.id, quantity: 1, version: 1 })
  const saved = await repository.move(owner, { itemId: added.lines[0].id, action: 'SAVE', version: added.version })
  await db.productVariant.update({ where: { id: variant.id }, data: { deletedAt: new Date() } })
  const read = await repository.read(owner)
  assert.equal(read.saved[0].valid, false)
  await assert.rejects(repository.move(owner, { itemId: saved.saved[0].id, action: 'RESTORE', version: saved.version }), /stock/)
  assert.equal((await repository.read(owner)).saved.length, 1)
})
test('agregar combo usa componentes fijos, cuenta piezas reales y suma demanda con unidades', async () => {
  const variants = await fixture(), owner = hash()
  const bundle = await db.bundle.create({ data: { code: `FIXTURE-${randomUUID()}`, slug: `fixture-${randomUUID()}`, name: 'Combo sintético', priceCents: 2500n, bundleComponent_bundle: { create: variants.map((v, i) => ({ variantId: v.id, quantity: i + 1 })) } } })
  const first = await repository.add(owner, { bundleId: bundle.id, quantity: 2, version: 1 })
  assert.equal(first.pieces, 6); assert.equal(first.products, 1); assert.equal(first.totals.goodsMoneyCents, '5000')
  const second = await repository.add(owner, { variantId: variants[1].id, quantity: 8, version: first.version })
  assert.equal(second.pieces, 14)
  await assert.rejects(repository.add(owner, { bundleId: bundle.id, quantity: 1, version: second.version }), /stock/)
  assert.equal((await repository.read(owner)).pieces, 14)
  const lots = await db.inventoryLot.findMany({ where: { variantId: { in: variants.map(v => v.id) } } })
  assert.ok(lots.every(l => l.reservedQty === 0 && l.onHandQty === 12))
})
test('relacionados son relaciones explícitas y excluyen SKU activo y productos ocultos', async () => {
  const [source] = await fixture(), targets = await fixture()
  const catalog = createCatalogRepository(db)
  await db.productRelation.create({ data: { sourceProductId: source.productId, targetProductId: targets[0].productId, kind: 'CROSS_SELL' } })
  assert.equal((await catalog.recommendations([source.productId], 'RELATED')).length, 0)
  const result = await catalog.recommendations([source.productId], 'CROSS_SELL', [targets[0].id])
  assert.equal(result.length, 1); assert.deepEqual(result[0].variants.map(v => v.id), [targets[1].id])
  await db.product.update({ where: { id: targets[0].productId }, data: { publishedAt: null } })
  assert.equal((await catalog.recommendations([source.productId], 'CROSS_SELL')).length, 0)
})
test('cotizaciones persisten snapshot autoritativo, aíslan propietario y se invalidan al cambiar carrito', async () => {
  const [variant] = await fixture(), owner = hash(), warehouse = await db.warehouse.findFirst()
  await db.warehouse.update({ where: { id: warehouse.id }, data: { state: 'CX' } })
  const packageType = await db.packageType.create({ data: { code: `FIXTURE-${randomUUID()}`, innerLengthMm: 300, innerWidthMm: 300, innerHeightMm: 300, outerLengthMm: 310, outerWidthMm: 310, outerHeightMm: 310, tareWeightGrams: 100, maxGrossWeightGrams: 3000 } })
  try {
    const original = await repository.add(owner, { variantId: variant.id, quantity: 1, version: 1 })
    const destination = { name: 'Fixture', phone: '5555555555', street: 'Calle sintética 1', city: 'Ciudad sintética', state: 'CX', country: 'MX', postalCode: '01234' }
    const calls = []
    const provider = { quote: async input => { calls.push(input); return [{ carrierCode: 'fixture', serviceCode: 'ground', serviceName: 'Sintético', quotedAmountCents: '12550', currency: 'MXN', deliveryEstimate: 'Estimación sintética' }] } }
    const shipping = createShippingQuotes(db, provider)
    const result = await shipping.quote(owner, destination)
    assert.equal(calls.length, 1); assert.equal(calls[0].package.grossWeightGrams >= 100, true)
    const quote = result.quotes[0]
    assert.equal(quote.chargedAmountCents, '12550')
    await assert.rejects(shipping.select(hash(), quote.id, destination), /Carrito/)
    const selected = await shipping.select(owner, quote.id, destination)
    assert.equal(selected.id, quote.id); assert.equal((await shipping.selected(owner)).id, quote.id)
    const saved = await db.shippingQuote.findUnique({ where: { id: quote.id } })
    assert.equal(saved.destinationSnapshot.postalCode, '01234'); assert.ok(saved.packageSnapshot.placements.length)
    await repository.edit(owner, { itemId: original.lines[0].id, quantity: 2, version: original.version })
    assert.equal(await shipping.selected(owner), null)
    assert.equal((await db.shippingQuote.findUnique({ where: { id: quote.id } })).status, 'INVALIDATED')
    const changing = createShippingQuotes(db, { quote: async () => { await db.productVariant.update({ where: { id: variant.id }, data: { priceCents: 2000n } }); return provider.quote(calls[0]) } })
    await assert.rejects(changing.quote(owner, destination), /cambiaron/)
    assert.equal(await db.shippingQuote.count({ where: { cartId: saved.cartId } }), 1)
  } finally {
    await db.warehouse.update({ where: { id: warehouse.id }, data: { state: warehouse.state } })
    await db.packageType.update({ where: { id: packageType.id }, data: { isActive: false } })
  }
})
test('cupón se aplica una vez, reemplaza, se revalida y desaparece descuento al vencer', async () => {
  const [variant] = await fixture(), owner = hash(), code = `fixture-${randomUUID()}`
  const coupon = await db.coupon.create({ data: { code, codeNormalized: code, kind: 'PERCENTAGE', percentageBasisPoints: 1000 } })
  const first = await repository.add(owner, { variantId: variant.id, quantity: 2, version: 1 })
  const applied = await repository.coupon(owner, { code: code.toUpperCase(), version: first.version })
  assert.equal(applied.totals.couponDiscountCents, '200'); assert.equal(applied.totals.goodsAfterCouponCents, '1800')
  assert.deepEqual(await repository.read(owner), applied)
  assert.equal(await db.couponUsage.count({ where: { couponId: coupon.id } }), 0)
  const changed = await repository.edit(owner, { itemId: first.lines[0].id, quantity: 3, version: applied.version })
  assert.equal(changed.totals.couponDiscountCents, '300')
  await db.coupon.update({ where: { id: coupon.id }, data: { endsAt: new Date(Date.now() - 1000) } })
  const expired = await repository.read(owner)
  assert.equal(expired.totals.couponDiscountCents, '0'); assert.match(expired.couponError, /vigencia/)
  const removed = await repository.coupon(owner, { remove: true, version: changed.version })
  assert.equal(removed.coupon, null); assert.equal(removed.couponError, null)
  const secondCode = `fixture-${randomUUID()}`
  await db.coupon.create({ data: { code: secondCode, codeNormalized: secondCode, kind: 'FIXED', fixedAmountCents: 100n } })
  const selected = await repository.coupon(owner, { code: secondCode, version: removed.version })
  assert.equal(selected.totals.couponDiscountCents, '100')
  const replacementCode = `fixture-${randomUUID()}`
  await db.coupon.create({ data: { code: replacementCode, codeNormalized: replacementCode, kind: 'FIXED', fixedAmountCents: 200n } })
  const replaced = await repository.coupon(owner, { code: replacementCode, version: selected.version })
  assert.equal(replaced.coupon.code, replacementCode); assert.equal(replaced.totals.couponDiscountCents, '200')
})
