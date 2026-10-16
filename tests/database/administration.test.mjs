import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'
import { createAccounts } from '../../server/features/accounts/account-repository.js'
import { deliveredFixture } from './order-fixture.mjs'
import { createCartRepository } from '../../server/features/cart/cart-repository.js'
import { createShippingQuotes } from '../../server/features/shipping/shipping-quotes.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
import { filterProducts, parseCatalogFilters } from '../../shared/features/catalog/filters.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), admin = createStoreAdministration(db)
test.after(() => db.$disconnect())
async function user(role = 'CUSTOMER') { const email = `${randomUUID()}@example.invalid`; return db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture', role } }) }
test('alta borrador, precio versionado, categorías, baja histórica y permisos', async () => {
  const actor = await user('ADMIN'), customer = await user(), code = randomUUID(), input = { name: 'Fixture', description: 'Solo pruebas', slug: code, reason: 'Fixture', variants: [{ sku: code.toUpperCase(), flavor: 'Fixture', presentationLabel: 'Fixture', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 }] }
  await assert.rejects(admin.createDraft(customer.id, input), e => e.status === 403)
  const product = await admin.createDraft(actor.id, input), variant = await db.productVariant.findFirst({ where: { productId: product.id } })
  assert.equal(product.published, false)
  await assert.rejects(admin.checkDraftIdentifiers(customer.id, { slug: code }), e => e.status === 403)
  assert.deepEqual(await admin.checkDraftIdentifiers(actor.id, { slug: code, sku: code.toUpperCase() }), { slugExists: true, skuExists: true })
  assert.deepEqual(await admin.checkDraftIdentifiers(actor.id, { slug: `nuevo-${code}`, sku: `NUEVO-${code.toUpperCase()}` }), { slugExists: false, skuExists: false })
  assert.deepEqual(await admin.checkDraftIdentifiers(actor.id, { sku: ` ${code.toUpperCase()} ` }), { slugExists: false, skuExists: true })
  await assert.rejects(admin.checkDraftIdentifiers(actor.id, { slug: ['invalid'] }), e => e.status === 400)
  await assert.rejects(admin.checkDraftIdentifiers(actor.id, { sku: 'minusculas' }), e => e.status === 400)
  await assert.rejects(admin.createDraft(actor.id, input), e => e.code === 'P2002')
  await assert.rejects(admin.createDraft(actor.id, { ...input, slug: `otro-${code}` }), e => e.code === 'P2002')
  assert.equal(await db.product.count({ where: { slug: `otro-${code}` } }), 0)
  await assert.rejects(admin.updateProduct(actor.id, product.id, { published: true, reason: 'Fixture' }), e => e.status === 409)
  await admin.updateVariant(actor.id, variant.id, { priceCents: '1500', expectedPriceVersion: 1, reason: 'Fixture' })
  assert.equal((await db.productVariant.findUnique({ where: { id: variant.id } })).priceCents, 1500n)
  await assert.rejects(admin.updateVariant(actor.id, variant.id, { priceCents: '100', expectedPriceVersion: 1, reason: 'Fixture' }), e => e.status === 409)
  await assert.rejects(admin.updateVariant(actor.id, variant.id, { priceCents: '-1', expectedPriceVersion: 2, reason: 'Fixture' }), e => e.status === 400)
  const category = await db.category.create({ data: { slug: `fixture-${randomUUID()}`, name: 'Fixture' } })
  await admin.updateProduct(actor.id, product.id, { categoryIds: [category.id], deactivate: true, reason: 'Fixture' })
  assert.ok((await db.product.findUnique({ where: { id: product.id } })).deletedAt)
  assert.deepEqual(await admin.checkDraftIdentifiers(actor.id, { slug: code, sku: code.toUpperCase() }), { slugExists: true, skuExists: true })
  assert.equal(await db.productVariant.count({ where: { productId: product.id } }), 1)
  assert.equal(await db.productCategory.count({ where: { productId: product.id } }), 1)
  assert.equal(await db.auditEvent.count({ where: { actorId: actor.id } }), 3)
})
test('reactivación administrativa conserva variantes e inventario, exige versión y regresa a borrador', async () => {
  const actor = await user('ADMIN'), customer = await user(), code = randomUUID()
  const product = await admin.createDraft(actor.id, { name: 'Reactivación sintética', description: 'Solo pruebas', slug: code, reason: 'Fixture', variants: [{ sku: code.toUpperCase(), flavor: 'Fixture', presentationLabel: 'Fixture', contentAmount: '100', contentUnit: 'g', priceCents: '15000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 }] })
  const variant = await db.productVariant.findFirst({ where: { productId: product.id } })
  await admin.updateProduct(actor.id, product.id, { deactivate: true, reason: 'Fixture' })
  const disabled = await db.product.findUnique({ where: { id: product.id } })
  const input = { expectedUpdatedAt: disabled.updatedAt.toISOString(), reason: 'Revisar antes de publicar' }
  await assert.rejects(admin.reactivateProduct(customer.id, product.id, input), e => e.status === 403)
  await assert.rejects(admin.reactivateProduct(actor.id, product.id, { ...input, reason: '' }), e => e.status === 400)
  await assert.rejects(admin.reactivateProduct(actor.id, product.id, { ...input, expectedUpdatedAt: 'obsoleto' }), e => e.status === 409)
  assert.ok((await db.product.findUnique({ where: { id: product.id } })).deletedAt)
  await admin.reactivateProduct(actor.id, product.id, input)
  const restored = await db.product.findUnique({ where: { id: product.id } })
  assert.equal(restored.deletedAt, null); assert.equal(restored.publishedAt, null)
  assert.deepEqual(await db.productVariant.findUnique({ where: { id: variant.id } }), variant)
  assert.equal(await db.auditEvent.count({ where: { entityId: product.id, action: 'REACTIVATE_PRODUCT', reason: input.reason } }), 1)
  await assert.rejects(admin.reactivateProduct(actor.id, product.id, { ...input, expectedUpdatedAt: restored.updatedAt.toISOString() }), e => e.status === 409)
  await assert.rejects(admin.updateProduct(actor.id, product.id, { published: true, reason: 'Fixture' }), e => e.status === 409)
  await admin.updateProduct(actor.id, product.id, { name: 'Reactivado editable', reason: 'Fixture' })
  assert.equal((await db.product.findUnique({ where: { id: product.id } })).name, 'Reactivado editable')
})

test('buscador de variantes para lotes exige administrador, busca nombre/SKU e ignora bajas', async () => {
  const actor = await user('ADMIN'), customer = await user(), code = randomUUID()
  const input = { name: `Proteína sintética ${code}`, description: 'Solo pruebas', slug: code, reason: 'Fixture', variants: [{ sku: `LOTE-${code.toUpperCase()}`, flavor: 'Chocolate', presentationLabel: 'Bote', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 }] }
  const product = await admin.createDraft(actor.id, input)
  await assert.rejects(admin.searchLotVariants(customer.id, code), e => e.status === 403)
  await assert.rejects(admin.searchLotVariants(actor.id, ['inválido']), e => e.status === 400)
  assert.deepEqual(await admin.searchLotVariants(actor.id, ''), { variants: [], hasMore: false })
  const result = await admin.searchLotVariants(actor.id, `proteina sintetica ${code}`)
  assert.equal(result.variants.length, 1)
  assert.equal(result.variants[0].productName, input.name)
  assert.equal(result.variants[0].sku, input.variants[0].sku)
  assert.equal(result.variants[0].flavor, 'Chocolate')
  assert.equal((await admin.searchLotVariants(actor.id, input.variants[0].sku.toLowerCase())).variants.length, 1)
  assert.equal((await admin.searchLotVariants(actor.id, `%${code}`)).variants.length, 0)
  await db.productVariant.updateMany({ where: { productId: product.id }, data: { deletedAt: new Date() } })
  assert.equal((await admin.searchLotVariants(actor.id, code)).variants.length, 0)
  await db.productVariant.updateMany({ where: { productId: product.id }, data: { deletedAt: null } })
  await admin.updateProduct(actor.id, product.id, { deactivate: true, reason: 'Fixture' })
  assert.equal((await admin.searchLotVariants(actor.id, code)).variants.length, 0)
})

test('porciones se crean, editan y eliminan por variante, actualizan el filtro y validan permisos', async () => {
  const actor = await user('ADMIN'), customer = await user(), code = randomUUID()
  const input = { name: 'Porciones sintéticas', slug: code, description: 'Solo pruebas', reason: 'Fixture', variants: [{ sku: code.toUpperCase(), flavor: 'Fixture', presentationLabel: 'Bote', contentAmount: '1000', contentUnit: 'g', priceCents: '60000', servings: '30', weightGrams: 1000, lengthMm: 100, widthMm: 100, heightMm: 100 }] }
  const product = await admin.createDraft(actor.id, input)
  const variant = await db.productVariant.findFirst({ where: { productId: product.id } })
  assert.equal(variant.servings.toString(), '30')
  const overview = await admin.overview(actor.id, 'products')
  assert.equal(overview.products.find(p => p.id === product.id).variants[0].servings, '30')
  const publication = new Date('2026-01-01T00:00:00Z')
  await db.product.update({ where: { id: product.id }, data: { publishedAt: publication } })
  const repository = createCatalogRepository(db)
  const matches = async bucket => filterProducts([await repository.getById(product.id)], parseCatalogFilters({ porcion: bucket })).length
  assert.equal(await matches('15-30'), 1)
  const change = { servings: '60', expectedPriceVersion: 1, reason: 'Actualizar etiqueta sintética' }
  await assert.rejects(admin.updateVariant(customer.id, variant.id, change), e => e.status === 403)
  await admin.updateProduct(actor.id, product.id, { variants: [{ id: variant.id, ...change }], reason: change.reason })
  assert.equal(await matches('menos-15'), 1)
  assert.equal((await db.product.findUnique({ where: { id: product.id } })).publishedAt.toISOString(), publication.toISOString())
  for (const servings of ['0', '-1', '2.12345', '10000000000', 30]) await assert.rejects(admin.updateVariant(actor.id, variant.id, { servings, expectedPriceVersion: 2, reason: 'Fixture' }), e => e.status === 400)
  assert.equal((await db.productVariant.findUnique({ where: { id: variant.id } })).servings.toString(), '60')
  await admin.updateVariant(actor.id, variant.id, { priceCents: '66000', expectedPriceVersion: 2, reason: 'Cambiar solo precio' })
  assert.equal((await db.productVariant.findUnique({ where: { id: variant.id } })).servings.toString(), '60')
  await admin.updateVariant(actor.id, variant.id, { servings: null, expectedPriceVersion: 3, reason: 'Dato sin documentar' })
  assert.equal(await matches('menos-15'), 0)
  assert.equal((await db.productVariant.findUnique({ where: { id: variant.id } })).servings, null)
  const audit = await db.auditEvent.findFirst({ where: { entityId: variant.id, reason: change.reason } })
  assert.equal(audit.safeBefore.servings, '30'); assert.equal(audit.safeAfter.servings, '60')
})

test('ajuste por ledger idempotente y desactivación de cuenta revoca sesiones', async () => {
  const actor = await user('ADMIN'), buyer = await user(), f = await deliveredFixture(db, buyer.id), key = randomUUID()
  const input = { lotId: f.lot.id, delta: 3, reason: 'Fixture', idempotencyKey: key }
  const first = await admin.adjustStock(actor.id, input), second = await admin.adjustStock(actor.id, input)
  assert.equal(first.movementId, second.movementId); assert.equal((await db.inventoryLot.findUnique({ where: { id: f.lot.id } })).onHandQty, 3)
  await assert.rejects(admin.adjustStock(actor.id, { ...input, delta: 4 }))
  await assert.rejects(admin.adjustStock(actor.id, { ...input, delta: -4, idempotencyKey: randomUUID() }))
  const accounts = createAccounts(db, randomBytes(32).toString('base64')), registered = await accounts.register({ email: `${randomUUID()}@example.invalid`, displayName: 'Fixture', password: 'Contraseña de pruebas 123', passwordConfirmation: 'Contraseña de pruebas 123' })
  await admin.deactivateUser(actor.id, registered.user.id, { reason: 'Fixture' })
  assert.equal(await accounts.authenticate(registered.access), null)
  assert.ok((await admin.users(actor.id)).every(u => !('passwordHash' in u)))
  await assert.rejects(admin.users(buyer.id), e => e.status === 403)
})

test('consultas administrativas, creación de lotes y protección de información', async () => {
  const actor = await user('ADMIN'), customer = await user(), f = await deliveredFixture(db, customer.id)
  for (const section of ['products', 'inventory']) {
    await assert.rejects(admin.overview(customer.id, section), e => e.status === 403)
    await assert.rejects(admin.overview(actor.id, section, 0), e => e.status === 400)
  }
  const products = await admin.overview(actor.id, 'products')
  assert.ok(products.products.every(p => p.variants.every(v => typeof v.priceCents === 'string')))
  assert.doesNotThrow(() => JSON.stringify(products))
  const inventory = await admin.overview(actor.id, 'inventory')
  assert.ok(inventory.warehouses.length)
  const input = { sku: f.variant.sku, warehouseId: inventory.warehouses[0].id, lotCode: randomUUID(), expiresOn: '2031-01-31', reason: 'Lote sintético' }
  await assert.rejects(admin.createLot(customer.id, input), e => e.status === 403)
  await assert.rejects(admin.createLot(actor.id, { ...input, expiresOn: '2031-02-31' }), e => e.status === 400)
  const saved = await admin.createLot(actor.id, input)
  const lot = await db.inventoryLot.findUnique({ where: { id: saved.id } })
  assert.equal(lot.onHandQty, 0)
  assert.equal(lot.variantId, f.variant.id)
  assert.equal(lot.expiresOn.toISOString().slice(0,10), input.expiresOn)
  await admin.adjustStock(actor.id, { lotId: lot.id, delta: 5, reason: 'Entrada sintética', idempotencyKey: randomUUID() })
  assert.equal((await db.inventoryLot.findUnique({ where: { id: lot.id } })).onHandQty, 5)
  for (const initialQuantity of [-1, 1.5, 2147483648, '12', null]) {
    const lotCode = randomUUID()
    await assert.rejects(admin.createLot(actor.id, { ...input, lotCode, initialQuantity }), e => e.status === 400)
    assert.equal(await db.inventoryLot.count({ where: { lotCode } }), 0)
  }
  const stockedInput = { ...input, lotCode: randomUUID(), initialQuantity: 12 }
  const stocked = await admin.createLot(actor.id, stockedInput)
  assert.equal((await db.inventoryLot.findUnique({ where: { id: stocked.id } })).onHandQty, 12)
  const movement = await db.inventoryMovement.findMany({ where: { lotId: stocked.id } })
  assert.equal(movement.length, 1)
  assert.equal(movement[0].onHandDelta, 12)
  assert.equal(movement[0].reason, input.reason)
  assert.equal(movement[0].actorId, actor.id)
  const audit = await db.auditEvent.findFirst({ where: { entityId: stocked.id, action: 'CREATE_LOT' } })
  assert.equal(audit.safeAfter.initialQuantity, 12)
  await assert.rejects(admin.createLot(actor.id, stockedInput), e => e.code === 'P2002')
  assert.equal((await db.inventoryLot.findUnique({ where: { id: stocked.id } })).onHandQty, 12)
  assert.equal(await db.inventoryMovement.count({ where: { lotId: stocked.id } }), 1)
  await admin.adjustStock(actor.id, { lotId: stocked.id, delta: 5, reason: 'Nueva entrada', idempotencyKey: randomUUID() })
  assert.equal((await db.inventoryLot.findUnique({ where: { id: stocked.id } })).onHandQty, 17)
  const warehouseInput = { name: 'Fixture', recipientName: 'Fixture', phone: '0000000000', postalCode: '01000', state: 'CX', city: 'Fixture', district: 'Fixture', street: 'Fixture', exteriorNumber: '1', contactName: 'Fixture', reason: 'Fixture' }
  for (const state of ['ZZ', 'SLP', 'CDMX']) await assert.rejects(admin.configureWarehouse(actor.id, { ...warehouseInput, state }), e => e.status === 400)
  await assert.rejects(admin.configureWarehouse(customer.id, warehouseInput), e => e.status === 403)
  await assert.rejects(admin.configureWarehouse(actor.id, warehouseInput), e => e.status === 409)
})

test('edición de almacén exige permisos y versión, audita y obliga a recotizar sin modificar pedidos', async () => {
  const actor = await user('ADMIN'), customer = await user(), f = await deliveredFixture(db, customer.id)
  const warehouse = await db.warehouse.findFirst()
  const snapshot = await db.orderPackage.findFirst({ where: { orderId: f.order.id } })
  await admin.adjustStock(actor.id, { lotId: f.lot.id, delta: 3, reason: 'Fixture', idempotencyKey: randomUUID() })
  await db.packageType.create({ data: { code: `FIXTURE-${randomUUID()}`, innerLengthMm: 300, innerWidthMm: 300, innerHeightMm: 300, outerLengthMm: 310, outerWidthMm: 310, outerHeightMm: 310, tareWeightGrams: 100, maxGrossWeightGrams: 3000 } })
  const owner = randomBytes(32).toString('hex')
  await createCartRepository(db).add(owner, { variantId: f.variant.id, quantity: 1, version: 1 })
  const shipping = createShippingQuotes(db, { quote: async () => [{ carrierCode: 'fixture', serviceCode: 'ground', serviceName: 'Fixture', quotedAmountCents: '500', currency: 'MXN', deliveryEstimate: 'Fixture' }] })
  const destination = { country: 'MX', state: 'CX', postalCode: '01000', name: 'Fixture', phone: '0000000000', street: 'Fixture 1', city: 'Fixture' }
  const quoted = await shipping.quote(owner, destination)
  await shipping.select(owner, quoted.quotes[0].id, destination)
  const input = { ...warehouse, name: 'Almacén sintético editado', state: 'SL', interiorNumber: '2', references: 'Referencias sintéticas', expectedConfigurationVersion: warehouse.configurationVersion, reason: 'Fixture de edición' }
  await assert.rejects(admin.updateWarehouse(customer.id, input), e => e.status === 403)
  await assert.rejects(admin.updateWarehouse(actor.id, { ...input, expectedConfigurationVersion: 0 }), e => e.status === 400)
  await assert.rejects(admin.updateWarehouse(actor.id, { ...input, state: 'ZZ' }), e => e.status === 400)
  const results = await Promise.allSettled([admin.updateWarehouse(actor.id, input), admin.updateWarehouse(actor.id, { ...input, name: 'Otro cambio sintético' })])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409)
  const saved = await db.warehouse.findUnique({ where: { id: warehouse.id } })
  assert.equal(saved.configurationVersion, warehouse.configurationVersion+1)
  assert.equal(saved.state, 'SL'); assert.equal(saved.interiorNumber, '2')
  const visible = (await admin.overview(actor.id, 'inventory')).warehouses[0]
  for (const key of ['name', 'contactName', 'recipientName', 'phone', 'street', 'postalCode', 'state', 'interiorNumber', 'references', 'configurationVersion']) assert.equal(visible[key], saved[key])
  const events = await db.auditEvent.findMany({ where: { actorId: actor.id, action: 'UPDATE_WAREHOUSE' } })
  assert.equal(events.length, 1); assert.equal(events[0].reason, input.reason)
  assert.equal(await shipping.selected(owner), null)
  await assert.rejects(shipping.select(owner, quoted.quotes[0].id, destination), e => e.status === 409)
  assert.deepEqual((await db.orderPackage.findFirst({ where: { orderId: f.order.id } })).originSnapshot, snapshot.originSnapshot)
  const freshQuotes = await shipping.quote(owner, destination)
  assert.equal(freshQuotes.quotes.length, 1)
})

test('clasificación y edición completa del borrador conservan unicidad, propiedad y atomicidad', async () => {
  const actor = await user('ADMIN'), customer = await user(), code = randomUUID()
  const categoryInput = { name: `Tipo sintético ${code}`, slug: `tipo-${code}`, reason: 'Fixture' }
  await assert.rejects(admin.createCategory(customer.id, categoryInput), e => e.status === 403)
  await assert.rejects(admin.categories(customer.id), e => e.status === 403)
  const category = await admin.createCategory(actor.id, categoryInput)
  await assert.rejects(admin.createCategory(actor.id, { ...categoryInput, name: categoryInput.name.toUpperCase(), slug: `otro-${code}` }), e => e.status === 409)
  assert.ok((await admin.categories(actor.id)).some(item => item.id === category.id))
  const input = { name: 'Producto sintético editable', description: 'Solo pruebas', slug: code, reason: 'Alta sintética', categoryIds: [category.id], variants: [{ sku: code.toUpperCase(), flavor: 'Inicial', presentationLabel: 'Inicial', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 }] }
  const product = await admin.createDraft(actor.id, input)
  const variant = await db.productVariant.findFirst({ where: { productId: product.id } })
  const publishedAt = new Date('2026-01-01T00:00:00.000Z')
  await db.product.update({ where: { id: product.id }, data: { publishedAt } })
  let detail = (await admin.overview(actor.id, 'products')).products.find(item => item.id === product.id)
  assert.equal(detail.categories[0].id, category.id); assert.equal(detail.categories[0].isPrimary, true)
  assert.equal(detail.creationReason, input.reason)
  for (const key of ['sku', 'flavor', 'presentationLabel', 'contentAmount', 'contentUnit', 'priceCents', 'weightGrams', 'lengthMm', 'widthMm', 'heightMm']) assert.equal(detail.variants[0][key], input.variants[0][key])
  const replacementCategory = await admin.createCategory(actor.id, { name: `Otra clasificación sintética ${code}`, slug: `otra-${code}`, reason: 'Fixture' })
  const update = { name: 'Nombre editado', description: 'Descripción editada', slug: `editado-${code}`, categoryIds: [replacementCategory.id], reason: 'Edición sintética', expectedUpdatedAt: detail.updatedAt, variants: [{ id: variant.id, expectedPriceVersion: variant.priceVersion, sku: `EDITADO-${code.toUpperCase()}`, flavor: 'Nuevo sabor', presentationLabel: 'Nueva presentación', contentAmount: '250.5', contentUnit: 'ml', priceCents: '2500', weightGrams: 350, lengthMm: 120, widthMm: 130, heightMm: 140 }] }
  await assert.rejects(admin.updateProduct(customer.id, product.id, update), e => e.status === 403)
  await admin.updateProduct(actor.id, product.id, update)
  assert.equal((await db.product.findUnique({ where: { id: product.id } })).publishedAt.toISOString(), publishedAt.toISOString())
  detail = (await admin.overview(actor.id, 'products')).products.find(item => item.id === product.id)
  assert.equal(detail.slug, update.slug); assert.equal(detail.name, update.name)
  assert.equal(detail.categories[0].id, replacementCategory.id)
  for (const key of ['sku', 'flavor', 'presentationLabel', 'contentAmount', 'contentUnit', 'priceCents', 'weightGrams', 'lengthMm', 'widthMm', 'heightMm']) assert.equal(detail.variants[0][key], update.variants[0][key])
  await assert.rejects(admin.updateProduct(actor.id, product.id, update), e => e.status === 409)
  const second = await admin.createDraft(actor.id, { ...input, slug: `segundo-${code}`, variants: [{ ...input.variants[0], sku: `SEGUNDO-${code.toUpperCase()}` }] })
  const foreignVariant = await db.productVariant.findFirst({ where: { productId: second.id } })
  await assert.rejects(admin.updateProduct(actor.id, product.id, { ...update, expectedUpdatedAt: detail.updatedAt, variants: [{ ...update.variants[0], id: foreignVariant.id, expectedPriceVersion: foreignVariant.priceVersion }] }), e => e.status === 404)
  await assert.rejects(admin.updateProduct(actor.id, product.id, { ...update, name: 'No debe persistir', expectedUpdatedAt: detail.updatedAt, categoryIds: [category.id], variants: [{ ...update.variants[0], expectedPriceVersion: detail.variants[0].priceVersion, sku: foreignVariant.sku }] }), e => e.code === 'P2002')
  assert.equal((await db.product.findUnique({ where: { id: product.id } })).name, 'Nombre editado')
  assert.equal((await db.productCategory.findFirst({ where: { productId: product.id } })).categoryId, replacementCategory.id)
})
