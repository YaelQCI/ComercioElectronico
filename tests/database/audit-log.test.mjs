import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createAuditLog } from '../../server/features/administration/read-audit-log.js'
import { createOrders } from '../../server/features/orders/order-repository.js'
import { deliveredFixture } from './order-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
const read = createAuditLog(db)
test.after(() => db.$disconnect())
async function user(role = 'ADMIN') {
  const email = `${randomUUID()}@example.invalid`
  return db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Auditoría sintética', role } })
}

test('auditoría restringida a administradores activos y parámetros acotados', async () => {
  const customer = await user('CUSTOMER'), admin = await user()
  await assert.rejects(read(customer.id), e => e.status === 403)
  await assert.rejects(read('sin-sesión'), e => e.status === 403)
  for (const params of [{ page: '0' }, { page: '1.5' }, { page: '10001' }, { page: ['1'] }, { q: ['texto'] }, { q: 'a'.repeat(121) }, { source: 'desconocido' }]) {
    await assert.rejects(read(admin.id, params), e => e.status === 400)
  }
  await db.user.update({ where: { id: admin.id }, data: { deletedAt: new Date() } })
  await assert.rejects(read(admin.id), e => e.status === 403)
})

test('auditoría pagina con orden estable, busca texto literal y no expone snapshots', async () => {
  const admin = await user(), marker = randomUUID(), entityId = randomUUID(), createdAt = new Date()
  await db.auditEvent.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ actorId: admin.id, actorType: 'ADMIN', entityType: 'Product', entityId, action: 'UPDATE_PRODUCT', reason: `${marker} cambio ${i}`, correlationId: marker, createdAt, safeAfter: { privateFixture: 'no exponer' } })) })
  const first = await read(admin.id, { q: marker }), second = await read(admin.id, { q: marker, page: '2' })
  assert.equal(first.total, 23); assert.equal(first.pages, 2); assert.equal(first.events.length, 20)
  assert.equal(second.events.length, 3)
  assert.equal(new Set([...first.events, ...second.events].map(e => e.id)).size, 23)
  assert.deepEqual(first.events.map(e => e.id), [...first.events].map(e => e.id).sort().reverse())
  assert.equal(first.events[0].actorName, admin.displayName)
  assert.equal(first.events[0].actorEmail, admin.email)
  assert.equal('safeAfter' in first.events[0], false)
  assert.equal((await read(admin.id, { q: entityId })).total, 23)
  assert.equal((await read(admin.id, { q: admin.email })).total, 23)
  assert.equal((await read(admin.id, { q: marker, page: '3' })).events.length, 0)
  await db.auditEvent.create({ data: { actorId: admin.id, actorType: 'ADMIN', entityType: 'Product', entityId, action: 'UPDATE_PRODUCT', reason: `${marker} literal %_\\`, correlationId: marker } })
  assert.equal((await read(admin.id, { q: `${marker} literal %_\\` })).total, 1)
  assert.equal((await read(admin.id, { q: `${marker}' OR TRUE --` })).total, 0)
  assert.equal((await read(admin.id, { q: marker, source: 'inventory' })).total, 0)
})

test('unifica motivos administrativos de inventario y pedidos con la auditoría general', async () => {
  const admin = await user(), customer = await user('CUSTOMER'), marker = randomUUID()
  await db.warehouse.upsert({ where: { singletonKey: 1 }, update: {}, create: { name: 'Almacén sintético; no comercial', recipientName: 'Fixture', contactName: 'Fixture', phone: '0000000000', postalCode: '01000', state: 'CX', city: 'Fixture', district: 'Fixture', street: 'Fixture', exteriorNumber: '1' } })
  await deliveredFixture(db, customer.id, { confirmedOnly: true })
  const order = await db.order.findFirstOrThrow({ where: { userId: customer.id } })
  const unit = await db.orderUnit.findFirstOrThrow({ where: { orderId: order.id } })
  await db.inventoryMovement.create({ data: { lotId: unit.lotId, kind: 'ADJUSTMENT', onHandDelta: 2, reason: marker, actorId: admin.id, actorType: 'ADMIN', idempotencyKey: randomUUID() } })
  await createOrders(db).advance(admin.id, order.id, { expectedStatus: 'CONFIRMED', status: 'PREPARING', reason: marker, idempotencyKey: randomUUID() })
  await db.auditEvent.create({ data: { actorId: admin.id, actorType: 'ADMIN', entityType: 'Product', entityId: randomUUID(), action: 'CREATE_DRAFT_PRODUCT', reason: marker, correlationId: marker } })
  const all = await read(admin.id, { q: marker })
  assert.equal(all.total, 3)
  assert.deepEqual(new Set(all.events.map(e => e.source)), new Set(['audit', 'inventory', 'orders']))
  for (const source of ['audit', 'inventory', 'orders']) {
    const result = await read(admin.id, { q: marker, source })
    assert.equal(result.total, 1); assert.equal(result.events[0].source, source)
  }
  assert.equal(all.events.find(e => e.source === 'orders').action, 'CONFIRMED → PREPARING')
  assert.equal((await read(admin.id, { q: order.id, source: 'orders' })).total, 1)
})
