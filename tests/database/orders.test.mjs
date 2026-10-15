import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createOrders } from '../../server/features/orders/order-repository.js'
import { deliveredFixture } from './order-fixture.mjs'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), orders = createOrders(db)
test.after(() => db.$disconnect())
async function user(role = 'CUSTOMER') { const email = `${randomUUID()}@example.invalid`; return db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture', role } }) }
test('consulta propia y snapshots, acceso ajeno rechazado, avance idempotente auditado', async () => {
  const buyer = await user(), other = await user(), admin = await user('ADMIN'), f = await deliveredFixture(db, buyer.id, { confirmedOnly: true })
  assert.equal((await orders.list(buyer.id)).total, 1)
  assert.ok(!('buyerEmail' in (await orders.list(buyer.id)).orders[0]))
  assert.equal((await orders.read(admin.id, f.order.id, true)).buyerEmail, buyer.email)
  assert.equal((await orders.list(admin.id, 1, true)).orders.find(o => o.id === f.order.id).buyerName, buyer.displayName)
  await assert.rejects(orders.read(other.id, f.order.id), e => e.status === 404)
  await assert.rejects(orders.list(other.id, 1, true), e => e.status === 403)
  const input = { status: 'PREPARING', expectedStatus: 'CONFIRMED', reason: 'Fixture', idempotencyKey: randomUUID() }
  await assert.rejects(orders.advance(other.id, f.order.id, input), e => e.status === 403)
  const results = await Promise.all([1,2].map(() => orders.advance(admin.id, f.order.id, input)))
  assert.equal(results.filter(r => !r.repeated).length, 1)
  await assert.rejects(orders.advance(admin.id, f.order.id, { ...input, reason: 'Otra' }), e => e.status === 409)
  await orders.advance(admin.id, f.order.id, { status: 'SHIPPED', expectedStatus: 'PREPARING', reason: 'Fixture', idempotencyKey: randomUUID() })
  await orders.advance(admin.id, f.order.id, { status: 'DELIVERED', expectedStatus: 'SHIPPED', reason: 'Fixture', idempotencyKey: randomUUID() })
  await db.product.update({ where: { id: f.product.id }, data: { name: 'Nombre actual diferente' } })
  const result = await orders.read(buyer.id, f.order.id)
  assert.equal(result.lines[0].name, 'Producto sintético'); assert.equal(result.moneyStatus, 'NOT_REQUIRED'); assert.equal(result.status, 'DELIVERED'); assert.equal(result.history.length, 4)
})
