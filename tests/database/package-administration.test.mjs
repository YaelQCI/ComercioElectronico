import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createPackageAdministration } from '../../server/features/shipping/manage-packages.js'
import { choosePackage } from '../../shared/features/shipping/pack-order.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), service = createPackageAdministration(db)
test.after(() => db.$disconnect())
async function user(role) {
  const email = `${randomUUID()}@example.invalid`
  return db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture', role } })
}
test('cajas: permisos, validación, duplicados, concurrencia, auditoría y empaque', async () => {
  const admin = await user('ADMIN'), customer = await user('CUSTOMER')
  const input = { code: `TEST-${randomUUID()}`, innerLengthMm: 300, innerWidthMm: 200, innerHeightMm: 200, outerLengthMm: 310, outerWidthMm: 210, outerHeightMm: 210, tareWeightGrams: 150, maxGrossWeightGrams: 5000, isActive: true, reason: 'Caja sintética aislada' }
  await assert.rejects(service.list(customer.id), e => e.status === 403)
  await assert.rejects(service.save(customer.id, input), e => e.status === 403)
  for (const change of [{ outerLengthMm: 100 }, { innerWidthMm: 0 }, { innerHeightMm: 1.5 }, { tareWeightGrams: -1 }, { maxGrossWeightGrams: 100 }, { isActive: 'true' }, { code: 'invalid code' }]) await assert.rejects(service.save(admin.id, { ...input, ...change }), e => e.status === 400)
  const box = await service.save(admin.id, input)
  await assert.rejects(service.save(admin.id, { ...input, code: input.code.toLowerCase() }), e => e.code === 'P2002')
  const units = [{ variantId: randomUUID(), quantity: 2, weightGrams: 1000, lengthMm: 100, widthMm: 100, heightMm: 100 }]
  assert.equal(choosePackage(units, [box]).grossWeightGrams, 2150)
  const edits = await Promise.allSettled([false, true].map(isActive => service.save(admin.id, { ...input, isActive, expectedVersion: 1 }, box.id)))
  assert.equal(edits.filter(item => item.status === 'fulfilled').length, 1)
  assert.equal(edits.find(item => item.status === 'rejected').reason.status, 409)
  const disabled = await service.save(admin.id, { ...input, isActive: false, expectedVersion: 2 }, box.id)
  assert.throws(() => choosePackage(units, [disabled]))
  const active = await service.save(admin.id, { ...input, maxGrossWeightGrams: null, isActive: true, expectedVersion: 3 }, box.id)
  assert.equal(choosePackage(units, [active]).packageVersion, 4)
  assert.ok((await service.list(admin.id)).packages.some(item => item.id === box.id))
  assert.equal(await db.auditEvent.count({ where: { entityType: 'PackageType', entityId: box.id } }), 4)
})
