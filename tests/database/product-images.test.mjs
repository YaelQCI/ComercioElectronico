import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'
import { createProductImages, createImageStorage } from '../../server/features/catalog/uploaded-images.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())

test('carga autorizada en borrador, publicación, frontal reemplazada y persistencia fuera de la transacción', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fitness-image-db-')), storage = createImageStorage(root)
  try {
    const adminEmail = `${randomUUID()}@example.invalid`, customerEmail = `${randomUUID()}@example.invalid`
    const actor = await db.user.create({ data: { email: adminEmail, emailNormalized: adminEmail, displayName: 'Fixture', role: 'ADMIN', passwordHash: 'fixture' } })
    const customer = await db.user.create({ data: { email: customerEmail, emailNormalized: customerEmail, displayName: 'Fixture', passwordHash: 'fixture' } })
    const admin = createStoreAdministration(db), code = randomUUID(), product = await admin.createDraft(actor.id, { name: 'Producto sintético', slug: code, description: 'Solo pruebas', reason: 'Fixture', variants: [{ sku: code.toUpperCase(), flavor: 'Fixture', presentationLabel: 'Fixture', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 }] })
    const images = createProductImages(db, storage), catalog = createCatalogRepository(db)
    const input = { bytes: await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer(), mimeType: 'image/png', kind: 'FRONT', alt: 'Imagen sintética de prueba', reason: 'Fixture' }
    await assert.rejects(images.add(customer.id, product.id, input), e => e.status === 403)
    await assert.rejects(images.add(actor.id, product.id, { ...input, alt: '' }), e => e.status === 400)
    assert.equal((await readdir(root)).length, 0)
    const first = await images.add(actor.id, product.id, input)
    const media = await db.productMedia.findUnique({ where: { id: first.id }, include: { asset: true } })
    assert.ok(await storage.read(media.asset))
    assert.equal(await catalog.imageAsset(media.assetId), null)
    assert.equal((await admin.overview(actor.id, 'products')).products.find(p => p.id === product.id).images[0].url, first.url)
    await admin.updateProduct(actor.id, product.id, { published: true, reason: 'Publicación de prueba' })
    assert.equal((await catalog.imageAsset(media.assetId)).id, media.assetId)
    assert.equal((await catalog.getById(product.id)).images[0].url, first.url)
    const second = await images.add(actor.id, product.id, input)
    assert.equal(await db.productMedia.count({ where: { productId: product.id, kind: 'FRONT' } }), 1)
    assert.equal((await db.productMedia.findUnique({ where: { id: first.id } })).kind, 'GALLERY')
    assert.equal((await db.productMedia.findUnique({ where: { id: second.id } })).kind, 'FRONT')
    const rollback = createProductImages({ $transaction: run => db.$transaction(async tx => { await run(tx); throw Error('Rollback sintético') }) }, storage)
    await assert.rejects(rollback.add(actor.id, product.id, input), /Rollback/)
    assert.equal((await readdir(root)).length, 2)
    assert.equal(await db.productMedia.count({ where: { productId: product.id } }), 2)
    assert.equal(await db.auditEvent.count({ where: { actorId: actor.id, action: 'UPLOAD_PRODUCT_IMAGE' } }), 2)
    const variantId = (await db.productVariant.findFirst({ where: { productId: product.id } })).id
    await assert.rejects(images.add(actor.id, product.id, { ...input, variantId: randomUUID() }), e => e.status === 400 || e.status === 404)
    assert.equal((await readdir(root)).length, 2)
    const variantImage = await images.add(actor.id, product.id, { ...input, variantId })
    assert.equal((await db.productMedia.findUnique({ where: { id: variantImage.id } })).variantId, variantId)
    assert.equal((await db.productMedia.findUnique({ where: { id: second.id } })).kind, 'FRONT')
    assert.equal((await catalog.getById(product.id)).images.find(image => image.id === variantImage.id).variantId, variantId)
    await admin.updateProduct(actor.id, product.id, { deactivate: true, published: false, reason: 'Fixture' })
    assert.equal(await catalog.imageAsset(media.assetId), null)
    await assert.rejects(images.add(actor.id, product.id, input), e => e.status === 404)
  } finally {
    for (const name of await readdir(root)) await unlink(join(root, name))
    await rmdir(root)
  }
})
