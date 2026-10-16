import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { initialPolicies, ensureInitialPolicies } from '../../server/features/policies/initial-policies.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
test('políticas iniciales son borradores sin administrador ficticio y se conservan al reiniciar', async () => {
  const slugs = initialPolicies.map(p => p.slug)
  const sql = await readFile(new URL('../../prisma/migrations/20261016030000_initial_policy_drafts/migration.sql', import.meta.url), 'utf8')
  const insert = sql.slice(sql.indexOf('INSERT INTO')).replace(/\s*COMMIT;\s*$/, '')
  const rollback = new Error('rollback fixture')
  await assert.rejects(db.$transaction(async tx => {
    // Aislar la comprobación incluso si otras pruebas publicaron políticas previamente.
    await tx.contentPage.deleteMany({ where: { slug: { in: slugs } } })
    await tx.$executeRawUnsafe(insert)
    for (const policy of initialPolicies) {
      const saved = await tx.contentPage.findUniqueOrThrow({ where: { slug: policy.slug } })
      assert.equal(saved.content, policy.content); assert.equal(saved.title, policy.title)
      assert.equal(saved.publishedAt, null); assert.equal(saved.updatedById, null)
      assert.equal(saved.version, 1)
      assert.match(saved.content, /BORRADOR.*PENDIENTE/)
    }
    await tx.contentPage.update({ where: { slug: 'privacidad' }, data: { content: 'Edición conservada', version: 2 } })
    await tx.contentPage.delete({ where: { slug: 'terminos' } })
    const scoped = { $transaction: callback => callback(tx) }
    await ensureInitialPolicies(scoped)
    await ensureInitialPolicies(scoped)
    await tx.$executeRawUnsafe(insert)
    const edited = await tx.contentPage.findUniqueOrThrow({ where: { slug: 'privacidad' } })
    assert.equal(edited.content, 'Edición conservada'); assert.equal(edited.version, 2)
    assert.equal(await tx.contentPage.count({ where: { slug: { in: slugs } } }), 3)
    const email = `${randomUUID()}@example.invalid`
    const admin = await tx.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture', role: 'ADMIN' } })
    await tx.contentPage.update({ where: { slug: 'privacidad' }, data: { publishedAt: new Date(), updatedById: admin.id } })
    const published = await tx.contentPage.findUniqueOrThrow({ where: { slug: 'privacidad' } })
    await ensureInitialPolicies(scoped)
    await tx.$executeRawUnsafe(insert)
    assert.deepEqual(await tx.contentPage.findUniqueOrThrow({ where: { slug: 'privacidad' } }), published)
    throw rollback
  }), e => e === rollback)
})
test('una política publicada requiere un responsable identificado', async () => {
  await assert.rejects(db.contentPage.create({ data: { slug: 'fixture-invalid-publication', title: 'Fixture', content: 'Fixture', publishedAt: new Date() } }))
  assert.equal(await db.contentPage.count({ where: { slug: 'fixture-invalid-publication' } }), 0)
})
