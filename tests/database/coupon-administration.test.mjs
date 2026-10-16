import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createCouponAdministration } from '../../server/features/coupons/manage-coupons.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), service = createCouponAdministration(db)
test.after(() => db.$disconnect())
async function user(role = 'ADMIN') { const email = `${randomUUID()}@example.invalid`; return db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture', role } }) }
const input = () => ({ code: `TEST-${randomUUID()}`, kind: 'PERCENTAGE', percentageBasisPoints: 1500, scope: 'CATALOG', isActive: true, allowOffers: false, allowBundles: false, reason: 'Prueba aislada' })
test('cupones: permisos, normalización única, auditoría y edición concurrente', async () => {
  const actor = await user(), customer = await user('CUSTOMER'), original = input()
  await assert.rejects(service.save(customer.id, original), error => error.status === 403)
  await assert.rejects(service.list(customer.id), error => error.status === 403)
  await assert.rejects(service.options(customer.id), error => error.status === 403)
  const { coupon } = await service.save(actor.id, original)
  assert.equal(coupon.version, 1)
  await assert.rejects(service.save(actor.id, { ...original, code: original.code.toLowerCase() }), error => error.code === 'P2002')
  const update = { ...original, expectedVersion: 1, isActive: false }
  const results = await Promise.allSettled([service.save(actor.id, update, coupon.id), service.save(actor.id, update, coupon.id)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409)
  assert.equal((await db.coupon.findUnique({ where: { id: coupon.id } })).version, 2)
  await assert.rejects(service.save(actor.id, { ...original, code: 'RENAME', expectedVersion: 2 }, coupon.id), error => error.status === 400)
  assert.equal(await db.auditEvent.count({ where: { entityId: coupon.id } }), 2)
  await db.user.update({ where: { id: actor.id }, data: { deletedAt: new Date() } })
  await assert.rejects(service.save(actor.id, original), error => error.status === 403)
})
test('cupones: alcances, rollback, búsqueda, paginación y contadores', async () => {
  const actor = await user(), product = await db.product.create({ data: { name: 'Cupón fixture', slug: randomUUID(), description: 'Prueba' } }), category = await db.category.create({ data: { name: 'Cupón fixture', slug: randomUUID() } })
  const original = { ...input(), scope: 'PRODUCTS', productIds: [product.id], kind: 'FIXED', fixedAmountCents: '10050', minimumEligibleCents: '20000' }
  const { coupon } = await service.save(actor.id, original)
  assert.equal(coupon.products[0].id, product.id)
  assert.equal(coupon.fixedAmountCents, '10050')
  const changed = await service.save(actor.id, { ...original, scope: 'CATEGORIES', categoryIds: [category.id], expectedVersion: 1 }, coupon.id)
  assert.equal(changed.coupon.products.length, 0)
  assert.equal(changed.coupon.categories[0].id, category.id)
  await db.category.update({ where: { id: category.id }, data: { isActive: false } })
  const disabled = await service.save(actor.id, { ...original, scope: 'CATEGORIES', categoryIds: [category.id], expectedVersion: 2, isActive: false }, coupon.id)
  assert.equal(disabled.coupon.isActive, false)
  await assert.rejects(service.save(actor.id, { ...original, productIds: [randomUUID()], expectedVersion: 3 }, coupon.id), error => error.status === 400)
  assert.equal((await db.coupon.findUnique({ where: { id: coupon.id } })).version, 3)
  const options = await service.options(actor.id, 'Cupón fixture')
  assert.ok(options.products.some(p => p.id === product.id))
  assert.ok(!options.categories.some(c => c.id === category.id))
  const listed = await service.list(actor.id)
  assert.equal(listed.coupons.find(c => c.id === coupon.id).uses.CONSUMED, 0)
  for (let i = 0; i < 11; i++) await service.save(actor.id, input())
  const second = await service.list(actor.id, 2)
  assert.equal(second.page, 2)
  assert.ok(second.coupons.length > 0 && second.coupons.length <= 10)
})
