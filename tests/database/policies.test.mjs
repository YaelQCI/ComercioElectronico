import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createPolicies } from '../../server/features/policies/policy-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), policies = createPolicies(db)
test.after(() => db.$disconnect())
test('publicación explícita, rol, concurrencia, versión y auditoría de texto', async () => {
  const email = `${randomUUID()}@example.invalid`, user = await db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture' } })
  const slug = 'privacidad', version = (await db.contentPage.findUnique({ where: { slug } }))?.version ?? 0
  const input = { title: 'Política sintética de pruebas', content: 'No es una política comercial. <script>texto</script>', expectedVersion: version, approved: true, reason: 'Publicación sintética aislada' }
  await assert.rejects(policies.publish(user.id, slug, input), e => e.status === 403)
  await assert.rejects(policies.administration(user.id), e => e.status === 403)
  await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  const overview = await policies.administration(user.id)
  assert.deepEqual(overview.policies.map(p => p.slug), ['privacidad', 'terminos', 'devoluciones'])
  for (const policy of overview.policies) {
    const saved = await db.contentPage.findUnique({ where: { slug: policy.slug } })
    assert.equal(policy.version, saved?.version ?? 0)
    assert.equal(policy.content, saved?.content ?? '')
  }
  await assert.rejects(policies.publish(user.id, slug, { ...input, reason: '' }), e => e.status === 400)
  await assert.rejects(policies.publish(user.id, slug, { ...input, approved: false }), e => e.status === 400)
  const results = await Promise.allSettled([1,2].map(() => policies.publish(user.id, slug, input)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, results.filter(r => r.status === 'rejected').map(r => r.reason.message).join('; '))
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409)
  const published = await policies.published(slug)
  assert.equal(published.version, version + 1); assert.equal(published.content, input.content)
  const updated = (await policies.administration(user.id)).policies.find(p => p.slug === slug)
  assert.equal(updated.content, input.content); assert.equal(updated.published, true)
  const events = await db.auditEvent.findMany({ where: { correlationId: `policy:${slug}:${version+1}` } })
  assert.equal(events.length, 1); assert.equal(events[0].safeAfter.content, input.content)
  assert.equal(events[0].reason, input.reason)
  await assert.rejects(policies.published('desconocida'), e => e.status === 404)
})
