import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
const service = createStoreAdministration(db), catalog = createCatalogRepository(db)
test.after(() => db.$disconnect())

test('selección del inicio: permisos, prioridad, retiro, auditoría y publicación', async () => {
  async function user(role) { const email = `${randomUUID()}@example.invalid`; return db.user.create({ data: { email, emailNormalized: email, displayName: 'Fixture', passwordHash: 'fixture', role } }) }
  const admin = await user('ADMIN'), customer = await user('CUSTOMER')
  async function draft() {
    const code = randomUUID()
    return service.createDraft(admin.id, { name: 'Selección sintética', description: 'Solo pruebas', slug: code, reason: 'Fixture', variants: [{ sku: code.toUpperCase(), flavor: 'Prueba', presentationLabel: 'Bote', contentAmount: '100', contentUnit: 'g', priceCents: '10000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 }] })
  }
  const first = await draft(), second = await draft()
  const change = (id, featuredPosition) => service.updateProduct(admin.id, id, { featuredPosition, reason: 'Configurar selección sintética' })
  await assert.rejects(service.updateProduct(customer.id, first.id, { featuredPosition: 1, reason: 'Fixture' }), e => e.status === 403)
  for (const value of [-1, 1.5, '1', true, 1001]) await assert.rejects(change(first.id, value), e => e.status === 400)
  await change(first.id, 2)
  await change(second.id, 1)
  assert.ok(!(await catalog.home()).featured.some(p => p.id === first.id || p.id === second.id))
  await db.product.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { publishedAt: new Date('2020-01-01') } })
  const shown = (await catalog.home()).featured.filter(p => [first.id, second.id].includes(p.id))
  assert.deepEqual(shown.map(p => p.id), [second.id, first.id])
  const overview = await service.overview(admin.id, 'products')
  assert.equal(overview.products.find(p => p.id === first.id).featuredPosition, 2)
  const events = await db.auditEvent.findMany({ where: { entityId: first.id, action: 'UPDATE_PRODUCT' } })
  assert.equal(events[0].safeBefore.featuredPosition, null)
  assert.equal(events[0].safeAfter.featuredPosition, 2)
  await assert.rejects(service.updateProduct(admin.id, first.id, { featuredPosition: 3, expectedUpdatedAt: '2000-01-01T00:00:00.000Z', reason: 'Obsoleto' }), e => e.status === 409)
  await change(first.id, null)
  assert.ok(!(await catalog.home()).featured.some(p => p.id === first.id))
  await service.updateProduct(admin.id, second.id, { deactivate: true, reason: 'Fixture' })
  assert.ok(!(await catalog.home()).featured.some(p => p.id === second.id))
  assert.equal((await db.product.findUnique({ where: { id: first.id } })).publishedAt.toISOString(), '2020-01-01T00:00:00.000Z')
})
