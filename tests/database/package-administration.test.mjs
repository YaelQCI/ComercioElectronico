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
  const first = await service.list(admin.id)
  const listed = []
  for (let page = 1; page <= first.totalPages; page++) listed.push(...(await service.list(admin.id, page)).packages)
  assert.ok(listed.some(item => item.id === box.id))
  assert.equal(await db.auditEvent.count({ where: { entityType: 'PackageType', entityId: box.id } }), 4)
})

test('cajas: páginas de cinco, orden estable y validación', async () => {
  const admin = await user('ADMIN')
  for (let index = 0; index < 6; index++) await service.save(admin.id, { code: `PAGE-${randomUUID()}`, innerLengthMm: 100, innerWidthMm: 100, innerHeightMm: 100, outerLengthMm: 110, outerWidthMm: 110, outerHeightMm: 110, tareWeightGrams: 100, maxGrossWeightGrams: 1000, isActive: true, reason: 'Prueba de paginación' })
  const expected = await db.packageType.findMany({ orderBy: [{ code: 'asc' }, { id: 'asc' }] })
  const ids = []
  for (let page = 1; page <= Math.ceil(expected.length / 5); page++) {
    const result = await service.list(admin.id, String(page))
    assert.equal(result.page, page)
    assert.equal(result.pageSize, 5)
    assert.equal(result.total, expected.length)
    assert.equal(result.totalPages, Math.ceil(expected.length / 5))
    assert.deepEqual(result.packages.map(box => box.id), expected.slice((page - 1) * 5, page * 5).map(box => box.id))
    ids.push(...result.packages.map(box => box.id))
  }
  assert.equal(new Set(ids).size, expected.length)
  assert.equal((await service.list(admin.id, 999999)).page, Math.ceil(expected.length / 5))
  for (const page of [0, -1, 'abc', '1.5', [], ['1', '2'], Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(service.list(admin.id, page), error => error.status === 400)
})
