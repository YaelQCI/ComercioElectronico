import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createReviews, reviewInput } from '../../server/features/reviews/review-repository.js'
import { deliveredFixture } from './order-fixture.mjs'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), reviews = createReviews(db)
test.after(() => db.$disconnect())
async function user(role = 'CUSTOMER') { const email = `${randomUUID()}@example.invalid`; return db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture', role } }) }
test('compra entregada, edición única, estadísticas y moderación auditada', async () => {
  const buyer = await user(), other = await user(), admin = await user('ADMIN'), f = await deliveredFixture(db, buyer.id)
  assert.equal((await reviews.list(f.product.id)).total, 0)
  const data = { rating: 5, body: '<script>texto visible</script>', title: 'Prueba' }
  await assert.rejects(reviews.publish(other.id, f.product.id, data), e => e.status === 403)
  await reviews.publish(buyer.id, f.product.id, data)
  await reviews.publish(buyer.id, f.product.id, { ...data, rating: 3 })
  const list = await reviews.list(f.product.id)
  assert.equal(list.total, 1); assert.equal(list.average, 3); assert.equal(list.distribution[3], 1); assert.equal(list.reviews[0].verified, true)
  assert.equal((await reviews.mine(buyer.id, f.product.id)).body, data.body)
  await assert.rejects(reviews.moderate(other.id, list.reviews[0].id, { action: 'HIDE', reason: 'Fixture' }), e => e.status === 403)
  await reviews.moderate(admin.id, list.reviews[0].id, { action: 'HIDE', reason: 'Fixture' })
  assert.equal((await reviews.list(f.product.id)).total, 0)
  await reviews.publish(buyer.id, f.product.id, { rating: 4, body: 'Editada' })
  assert.equal((await reviews.list(f.product.id)).total, 0)
  await reviews.moderate(admin.id, list.reviews[0].id, { action: 'RESTORE', reason: 'Fixture' })
  assert.equal((await reviews.list(f.product.id)).average, 4)
  assert.equal(await db.reviewModeration.count({ where: { reviewId: list.reviews[0].id } }), 2)
})
test('rechaza calificación fraccionaria, vacíos y paginación inválida', async () => {
  assert.throws(() => reviewInput({ rating: 1.5, body: 'Prueba' }))
  assert.throws(() => reviewInput({ rating: 6, body: 'Prueba' }))
  assert.throws(() => reviewInput({ rating: 5, body: ' ' }))
  await assert.rejects(reviews.list(randomUUID(), -1), e => e.status === 400)
})
test('un componente de combo entregado habilita reseña del producto padre', async () => {
  const buyer = await user(), f = await deliveredFixture(db, buyer.id, { bundle: true })
  await reviews.publish(buyer.id, f.product.id, { rating: 5, body: 'Comprado dentro de combo' })
  assert.equal((await reviews.list(f.product.id)).total, 1)
})
