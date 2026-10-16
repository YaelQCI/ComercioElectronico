import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, unlink, rmdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'
import { createProductDetailsAdministration } from '../../server/features/catalog/manage-product-details.js'
import { createLotTraceabilityAdministration, createCertificateStorage } from '../../server/features/inventory/manage-lot-traceability.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), store = createStoreAdministration(db), details = createProductDetailsAdministration(db)
test.after(() => db.$disconnect())
async function user(role) { const email = `${randomUUID()}@example.invalid`; return db.user.create({ data: { email, emailNormalized: email, displayName: 'Fixture', passwordHash: 'fixture', role } }) }
const variant = () => ({ sku: `DET-${randomUUID().toUpperCase()}`, flavor: 'Chocolate', presentationLabel: randomUUID(), contentAmount: '500', contentUnit: 'g', priceCents: '15000', servings: '25', servingAmount: '20', servingUnit: 'g', nutritionData: { rows: [{ name: 'Proteína', amount: '18', unit: 'g' }] }, weightGrams: 600, lengthMm: 100, widthMm: 100, heightMm: 100 })
const product = actor => store.createDraft(actor.id, { name: 'Producto sintético detallado', slug: randomUUID(), description: 'Solo pruebas', reason: 'Fixture', variants: [variant()] })

test('ficha administrativa: marcas, textos, nutrientes, presentaciones, recomendaciones y rollback', async () => {
  const actor = await user('ADMIN'), customer = await user('CUSTOMER'), first = await product(actor), second = await product(actor)
  await assert.rejects(details.options(customer.id), e => e.status === 403)
  const brandInput = { name: `Marca ${randomUUID()}`, slug: randomUUID(), reason: 'Fixture' }
  await assert.rejects(details.createBrand(customer.id, brandInput), e => e.status === 403)
  const brand = await details.createBrand(actor.id, brandInput)
  await assert.rejects(details.createBrand(actor.id, { ...brandInput, name: brandInput.name.toLowerCase() }), e => e.status === 409)
  await store.updateProduct(actor.id, first.id, { brandId: brand.id, ingredients: 'Primera línea\nSegunda línea', usageInstructions: 'Uso documentado', allergenInformation: 'Alérgenos documentados', relatedProductIds: [second.id], crossSellProductIds: [second.id], reason: 'Completar ficha' })
  let saved = (await store.overview(actor.id, 'products')).products.find(p => p.id === first.id)
  assert.equal(saved.ingredients, 'Primera línea\nSegunda línea'); assert.equal(saved.brandId, brand.id)
  assert.equal(saved.recommendations.length, 2); assert.equal(saved.variants[0].servingAmount, '20'); assert.equal(saved.variants[0].nutritionData.rows[0].name, 'Proteína')
  const v = saved.variants[0], version = v.priceVersion
  const patch = change => store.updateProduct(actor.id, first.id, { reason: 'Editar presentación', variants: [{ id: v.id, expectedPriceVersion: version, ...change }] })
  for (const change of [{ servingAmount: '0', servingUnit: 'g' }, { servingAmount: '5', servingUnit: '' }, { nutritionData: { rows: [{ name: 'Proteína', amount: '-1', unit: 'g' }] } }, { nutritionData: { rows: [{ name: 'Proteína', amount: '1', unit: 'g' }, { name: 'proteína', amount: '2', unit: 'g' }] } }]) await assert.rejects(patch(change), e => e.status === 400)
  await assert.rejects(store.updateProduct(actor.id, first.id, { reason: 'Rollback', ingredients: 'No persistir', relatedProductIds: [first.id], variants: [{ id: v.id, expectedPriceVersion: version, priceCents: '20000' }] }), e => e.status === 400)
  assert.equal((await db.productVariant.findUnique({ where: { id: v.id } })).priceVersion, version)
  assert.equal((await db.product.findUnique({ where: { id: first.id } })).ingredients, saved.ingredients)
  await patch({ servingAmount: null, servingUnit: null, nutritionData: null })
  const cleared = await db.productVariant.findUnique({ where: { id: v.id } })
  assert.equal(cleared.nutritionData, null); assert.equal(cleared.servingAmount, null)
  const input = { ...variant(), expectedUpdatedAt: (await db.product.findUnique({ where: { id: first.id } })).updatedAt.toISOString(), reason: 'Nueva presentación' }
  await assert.rejects(details.createVariant(customer.id, first.id, input), e => e.status === 403)
  const added = await details.createVariant(actor.id, first.id, input)
  assert.ok(await db.productVariant.findUnique({ where: { id: added.id } }))
  await assert.rejects(details.createVariant(actor.id, first.id, { ...variant(), expectedUpdatedAt: '2000-01-01T00:00:00.000Z', reason: 'Obsoleto' }), e => e.status === 409)
  await assert.rejects(details.createVariant(actor.id, first.id, { ...input, expectedUpdatedAt: (await db.product.findUnique({ where: { id: first.id } })).updatedAt.toISOString() }), e => e.code === 'P2002')
  await db.product.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { publishedAt: new Date('2020-01-01') } })
  assert.deepEqual((await createCatalogRepository(db).recommendations([first.id], 'RELATED')).map(p => p.id), [second.id])
  await store.updateProduct(actor.id, first.id, { reason: 'Limpiar ficha', ingredients: '', relatedProductIds: [], brandId: null })
  assert.equal((await db.product.findUnique({ where: { id: first.id } })).ingredients, null)
  assert.equal(await db.productRelation.count({ where: { sourceProductId: first.id, kind: 'RELATED' } }), 0)
  assert.equal(await db.productRelation.count({ where: { sourceProductId: first.id, kind: 'CROSS_SELL' } }), 1)
  assert.ok(await db.auditEvent.count({ where: { entityId: first.id, action: 'UPDATE_PRODUCT_DETAILS' } }))
})

test('lotes: trazabilidad, PDF persistente, permisos, versión e integridad', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fitness-certificates-db-')), storage = createCertificateStorage(root), service = createLotTraceabilityAdministration(db, storage)
  try {
    const actor = await user('ADMIN'), customer = await user('CUSTOMER'), p = await product(actor), v = await db.productVariant.findFirst({ where: { productId: p.id } })
    const warehouse = await db.warehouse.upsert({ where: { singletonKey: 1 }, update: {}, create: { name: 'Almacén sintético', recipientName: 'Fixture', phone: '5555555555', postalCode: '01000', state: 'CMX', city: 'Fixture', district: 'Fixture', street: 'Fixture', exteriorNumber: '1', contactName: 'Fixture' } })
    const created = await store.createLot(actor.id, { sku: v.sku, warehouseId: warehouse.id, lotCode: randomUUID(), initialQuantity: 2, origin: 'Origen sintético', customsEntry: 'Registro sintético', importedOn: '2026-01-01', reason: 'Fixture' })
    const current = () => db.inventoryLot.findUnique({ where: { id: created.id } })
    const initial = await current(), input = { expectedVersion: initial.version, reason: 'Certificado sintético' }
    const pdf = { mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n') }
    await assert.rejects(service.save(customer.id, created.id, input, pdf), e => e.status === 403)
    await assert.rejects(service.save(actor.id, created.id, { ...input, importedOn: '2026-02-30' }), e => e.status === 400)
    await assert.rejects(service.save(actor.id, created.id, input, { ...pdf, bytes: Buffer.from('No es PDF') }), e => e.status === 400)
    await service.save(actor.id, created.id, input, pdf)
    const saved = await current(), asset = await db.mediaAsset.findUnique({ where: { id: saved.certificateAssetId } })
    assert.deepEqual(await storage.read(asset), pdf.bytes)
    assert.equal(saved.origin, initial.origin); assert.equal(saved.onHandQty, initial.onHandQty)
    assert.equal(saved.version, initial.version + 1)
    await assert.rejects(service.save(actor.id, created.id, input, pdf), e => e.status === 409)
    assert.equal((await readdir(join(root, 'certificates'))).length, 1)
    assert.equal(await createCatalogRepository(db).certificateForLot(created.id), null)
    await db.product.update({ where: { id: p.id }, data: { publishedAt: new Date('2020-01-01') } })
    assert.equal((await createCatalogRepository(db).certificateForLot(created.id)).id, asset.id)
    const overview = (await store.overview(actor.id, 'inventory')).lots.find(lot => lot.id === created.id)
    assert.ok(overview.certificateUrl); assert.equal(overview.origin, 'Origen sintético')
    await service.save(actor.id, created.id, { expectedVersion: saved.version, reason: 'Retirar PDF', removeCertificate: true })
    assert.equal((await current()).certificateAssetId, null); assert.equal((await current()).origin, initial.origin)
    assert.ok(await db.mediaAsset.findUnique({ where: { id: asset.id } }))
    await writeFile(join(root, 'certificates', asset.storageKey.split('/')[1]), Buffer.from('alterado'))
    assert.equal(await storage.read(asset), null)
    assert.equal(await db.auditEvent.count({ where: { entityId: created.id, action: 'UPDATE_LOT_TRACEABILITY' } }), 2)
  } finally { for (const file of await readdir(join(root, 'certificates')).catch(() => [])) await unlink(join(root, 'certificates', file)); await rmdir(join(root, 'certificates')).catch(() => {}); await rmdir(root) }
})
