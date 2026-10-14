import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { limitRequest } from '../../server/utils/request-limit.js'
import { requireAdministrator } from '../../server/utils/authorization.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
test('contador concurrente compartido acepta exactamente el límite y permite una nueva ventana', async () => {
  const key = randomUUID(), before = await db.requestLimit.count()
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => limitRequest(db, key, 3)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 3)
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.status === 429))
  assert.equal(await db.requestLimit.count(), before + 1)
  const { createHash } = await import('node:crypto'), keyHash = createHash('sha256').update(key).digest('hex')
  await db.requestLimit.update({ where: { keyHash }, data: { expiresAt: new Date(0) } })
  await limitRequest(db, key, 3); assert.equal((await db.requestLimit.findUnique({ where: { keyHash } })).hits, 1)
})
test('administración revalida rol y soft delete dentro de la transacción', async () => {
  const email = `${randomUUID()}@example.invalid`, user = await db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture' } })
  await assert.rejects(db.$transaction(tx => requireAdministrator(tx, user.id)), e => e.status === 403)
  await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  assert.equal((await db.$transaction(tx => requireAdministrator(tx, user.id))).role, 'ADMIN')
  await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } })
  await assert.rejects(db.$transaction(tx => requireAdministrator(tx, user.id)), e => e.status === 403)
})
