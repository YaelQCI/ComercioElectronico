import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createRestockSubscriptions, cancellationHash } from '../../server/features/restock/restock-subscriptions.js'
import { observeRestock, deliverRestock } from '../../server/features/restock/restock-worker.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar base aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
test.after(() => db.$disconnect())
const secret = randomBytes(32).toString('base64'), service = createRestockSubscriptions(db, secret), site = 'https://fixture.example.invalid'
async function fixture() {
  const warehouse = await db.warehouse.findFirst(), slug = `fixture-restock-${randomUUID()}`
  const product = await db.product.create({ data: { name: 'Reposición sintética', slug, description: 'Pruebas exclusivamente', publishedAt: new Date() } })
  const variant = await db.productVariant.create({ data: { productId: product.id, sku: slug.toUpperCase(), flavor: 'Neutro', flavorNormalized: 'neutro', presentationLabel: 'Fixture', presentationNormalized: 'fixture', contentAmount: '100', contentUnit: 'g', priceCents: 1000n, weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 } })
  const lot = await db.inventoryLot.create({ data: { variantId: variant.id, warehouseId: warehouse.id, lotCode: 'FIXTURE', expiresOn: new Date('2030-01-31'), expiryPrecision: 'MONTH' } })
  const input = { variantId: variant.id, email: `fixture-${randomUUID()}@example.invalid`, consent: true }
  return { variant, lot, input }
}
async function receipt(lot) { await db.inventoryMovement.create({ data: { lotId: lot.id, kind: 'RECEIPT', onHandDelta: 1, actorType: 'SYSTEM', reason: 'Prueba aislada', idempotencyKey: randomUUID() } }) }
const messageFor = id => db.outboxMessage.findFirst({ where: { kind: 'RESTOCK_NOTICE', payload: { path: ['variantId'], equals: id } } })
test('registro normaliza correo, exige consentimiento y no duplica suscripción; token solo en hash', async () => {
  const f = await fixture()
  await assert.rejects(service.subscribe({ ...f.input, consent: false }), /acepta/)
  await assert.rejects(service.subscribe({ ...f.input, email: 'inválido' }), /válido/)
  const results = await Promise.all([service.subscribe(f.input), service.subscribe({ ...f.input, email: f.input.email.toUpperCase() })])
  assert.equal(await db.restockSubscription.count({ where: { variantId: f.variant.id } }), 1)
  const fresh = results.find(r => r.cancelPath), token = new URLSearchParams(fresh.cancelPath.split('#')[1]).get('token')
  const saved = await db.restockSubscription.findFirst({ where: { variantId: f.variant.id } })
  assert.equal(saved.unsubscribeTokenHash, cancellationHash(token)); assert.notEqual(saved.unsubscribeTokenHash, token)
  await receipt(f.lot)
  await assert.rejects(service.subscribe({ ...f.input, email: 'other@example.invalid' }), /existencias/)
})
test('transición real genera una entrega única, enlace al SKU y finaliza suscripción', async () => {
  const f = await fixture(); await service.subscribe(f.input)
  assert.equal(await observeRestock(db, f.variant.id, site), 0)
  await receipt(f.lot)
  assert.equal(await observeRestock(db, f.variant.id, site), 1)
  assert.equal(await observeRestock(db, f.variant.id, site), 0)
  const message = await messageFor(f.variant.id), sent = []
  const dependencies = { tokenSecret: secret, mailer: { idempotencyWindowMs: 86400000, send: async mail => { sent.push(mail); return { id: 'fixture-receipt' } } } }
  const results = await Promise.all([deliverRestock(db, message.id, dependencies), deliverRestock(db, message.id, dependencies)])
  assert.equal(results.filter(r => r.sent).length, 1); assert.equal(sent.length, 1)
  assert.ok(sent[0].text.includes(`/producto/${f.variant.productId}?variante=${f.variant.id}`))
  const subscription = await db.restockSubscription.findFirst({ where: { variantId: f.variant.id } })
  assert.equal(subscription.state, 'NOTIFIED'); assert.ok(subscription.notifiedAt)
  assert.equal((await deliverRestock(db, message.id, dependencies)).sent, false)
})
test('cancelación antes del envío impide notificar y es idempotente', async () => {
  const f = await fixture(), result = await service.subscribe(f.input)
  const token = new URLSearchParams(result.cancelPath.split('#')[1]).get('token')
  await receipt(f.lot); await observeRestock(db, f.variant.id, site)
  await service.cancel(token); await service.cancel(token)
  let sent = 0
  await deliverRestock(db, (await messageFor(f.variant.id)).id, { tokenSecret: secret, mailer: { send: async () => { sent++; return { id: 'fixture' } } } })
  assert.equal(sent, 0)
  await assert.rejects(service.cancel('incorrecto'), /inválido/)
})
test('fallo no afirma éxito; reintento con misma clave no duplica aceptación del proveedor', async () => {
  const f = await fixture(); await service.subscribe(f.input); await receipt(f.lot); await observeRestock(db, f.variant.id, site)
  const message = await messageFor(f.variant.id), accepted = new Map()
  let calls = 0
  const dependencies = { tokenSecret: secret, mailer: { idempotencyWindowMs: 86400000, send: async mail => { calls++; if (!accepted.has(mail.idempotencyKey)) { accepted.set(mail.idempotencyKey, { id: 'fixture-accepted' }); throw new Error('Respuesta perdida después de aceptar') } return accepted.get(mail.idempotencyKey) } } }
  assert.equal((await deliverRestock(db, message.id, dependencies)).retry, true)
  assert.equal((await db.restockSubscription.findFirst({ where: { variantId: f.variant.id } })).state, 'ACTIVE')
  await db.outboxMessage.update({ where: { id: message.id }, data: { nextAttemptAt: new Date(0) } })
  assert.equal((await deliverRestock(db, message.id, dependencies)).sent, true)
  assert.equal(calls, 2); assert.equal(accepted.size, 1)
})
test('lote bloqueado/vencido no dispara aviso; falta de proveedor no consume mensaje', async () => {
  const f = await fixture(); await service.subscribe(f.input); await receipt(f.lot)
  await db.inventoryLot.update({ where: { id: f.lot.id }, data: { isBlocked: true } })
  assert.equal(await observeRestock(db, f.variant.id, site), 0)
  await db.inventoryLot.update({ where: { id: f.lot.id }, data: { isBlocked: false, expiresOn: new Date('2020-01-31') } })
  assert.equal(await observeRestock(db, f.variant.id, site), 0)
  await db.inventoryLot.update({ where: { id: f.lot.id }, data: { expiresOn: new Date('2030-01-31') } })
  await observeRestock(db, f.variant.id, site)
  const message = await messageFor(f.variant.id)
  await assert.rejects(deliverRestock(db, message.id, { tokenSecret: secret }), /no configurado/)
  assert.equal((await db.outboxMessage.findUnique({ where: { id: message.id } })).attempts, 0)
})
test('sin idempotencia no se reenvía tras resultado incierto; ventana agotada requiere revisión', async () => {
  const f = await fixture(); await service.subscribe(f.input); await receipt(f.lot); await observeRestock(db, f.variant.id, site)
  const message = await messageFor(f.variant.id)
  const dependencies = { tokenSecret: secret, mailer: { send: async () => { throw new Error('Timeout incierto') } } }
  assert.equal((await deliverRestock(db, message.id, dependencies)).retry, false)
  assert.equal((await db.outboxMessage.findUnique({ where: { id: message.id } })).state, 'FAILED')
  await db.outboxMessage.update({ where: { id: message.id }, data: { state: 'PENDING', nextAttemptAt: new Date(0), payload: { ...message.payload, firstAttemptAt: new Date(Date.now() - 86400000).toISOString() } } })
  let sent = 0
  await deliverRestock(db, message.id, { tokenSecret: secret, mailer: { idempotencyWindowMs: 86400000, send: async () => { sent++; return { id: 'fixture' } } } })
  assert.equal(sent, 0); assert.equal((await db.outboxMessage.findUnique({ where: { id: message.id } })).state, 'FAILED')
})
