import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'
import { createAccounts } from '../../server/features/accounts/account-repository.js'
import { deliveredFixture } from './order-fixture.mjs'
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
  await assert.rejects(admin.updateProduct(actor.id, product.id, { published: true, reason: 'Fixture' }), e => e.status === 409)
  await admin.updateVariant(actor.id, variant.id, { priceCents: '1500', expectedPriceVersion: 1, reason: 'Fixture' })
  assert.equal((await db.productVariant.findUnique({ where: { id: variant.id } })).priceCents, 1500n)
  await assert.rejects(admin.updateVariant(actor.id, variant.id, { priceCents: '100', expectedPriceVersion: 1, reason: 'Fixture' }), e => e.status === 409)
  await assert.rejects(admin.updateVariant(actor.id, variant.id, { priceCents: '-1', expectedPriceVersion: 2, reason: 'Fixture' }), e => e.status === 400)
  const category = await db.category.create({ data: { slug: `fixture-${randomUUID()}`, name: 'Fixture' } })
  await admin.updateProduct(actor.id, product.id, { categoryIds: [category.id], deactivate: true, reason: 'Fixture' })
  assert.ok((await db.product.findUnique({ where: { id: product.id } })).deletedAt)
  assert.equal(await db.productVariant.count({ where: { productId: product.id } }), 1)
  assert.equal(await db.productCategory.count({ where: { productId: product.id } }), 1)
  assert.equal(await db.auditEvent.count({ where: { actorId: actor.id } }), 3)
})
test('ajuste por ledger idempotente y desactivación de cuenta revoca sesiones', async () => {
  const actor = await user('ADMIN'), buyer = await user(), f = await deliveredFixture(db, buyer.id), key = randomUUID()
  const input = { lotId: f.lot.id, delta: 3, reason: 'Fixture', idempotencyKey: key }
  const first = await admin.adjustStock(actor.id, input), second = await admin.adjustStock(actor.id, input)
  assert.equal(first.movementId, second.movementId); assert.equal((await db.inventoryLot.findUnique({ where: { id: f.lot.id } })).onHandQty, 3)
  await assert.rejects(admin.adjustStock(actor.id, { ...input, delta: 4 }))
  await assert.rejects(admin.adjustStock(actor.id, { ...input, delta: -4, idempotencyKey: randomUUID() }))
  const accounts = createAccounts(db, randomBytes(32).toString('base64')), registered = await accounts.register({ email: `${randomUUID()}@example.invalid`, displayName: 'Fixture', password: 'Contraseña de pruebas 123' })
  await admin.deactivateUser(actor.id, registered.user.id, { reason: 'Fixture' })
  assert.equal(await accounts.authenticate(registered.access), null)
  assert.ok((await admin.users(actor.id)).every(u => !('passwordHash' in u)))
  await assert.rejects(admin.users(buyer.id), e => e.status === 403)
})
