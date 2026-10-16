import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createAdministratorRegistration } from '../../server/features/administration/register-administrator.js'
import { createAccounts } from '../../server/features/accounts/account-repository.js'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
const register = createAdministratorRegistration(db)
test.after(() => db.$disconnect())
async function actor(role = 'ADMIN', deletedAt = null) {
  const email = `${randomUUID()}@example.invalid`
  return db.user.create({ data: { email, emailNormalized: email, displayName: 'Fixture', passwordHash: 'fixture', role, deletedAt } })
}
const input = () => ({ email: `${randomUUID()}@example.invalid`, displayName: 'Administrador sintético', password: 'Clave-sintetica-123', passwordConfirmation: 'Clave-sintetica-123', reason: 'Prueba aislada' })

test('alta ADMIN permite login, conserva sesión del actor y audita sin contraseñas', async () => {
  const admin = await actor(), body = input()
  const session = await db.authSession.create({ data: { userId: admin.id, tokenFamilyId: randomUUID(), absoluteExpiresAt: new Date(Date.now() + 60000) } })
  const result = await register(admin.id, body)
  assert.deepEqual(Object.keys(result.user).sort(), ['displayName', 'email', 'id', 'role'])
  assert.equal(result.user.role, 'ADMIN')
  const accounts = createAccounts(db, randomBytes(32).toString('base64'))
  const login = await accounts.login({ email: body.email.toUpperCase(), password: body.password })
  assert.equal(login.user.id, result.user.id)
  assert.equal(login.user.role, 'ADMIN')
  assert.equal((await db.authSession.findUnique({ where: { id: session.id } })).revokedAt, null)
  const audits = await db.auditEvent.findMany({ where: { entityId: result.user.id } })
  assert.equal(audits.length, 1)
  assert.equal(audits[0].actorId, admin.id)
  assert.equal(audits[0].action, 'REGISTER_ADMINISTRATOR')
  assert.equal(audits[0].reason, body.reason)
  assert.deepEqual(audits[0].safeAfter, { role: 'ADMIN' })
  assert.ok(!JSON.stringify(audits).includes(body.password))
})

test('rechaza clientes, bajas e identidades ausentes sin crear cuentas', async () => {
  for (const id of [(await actor('CUSTOMER')).id, (await actor('ADMIN', new Date())).id, null]) {
    const body = input()
    await assert.rejects(register(id, body), error => error.status === 403)
    assert.equal(await db.user.count({ where: { emailNormalized: body.email } }), 0)
  }
})

test('valida datos y no promueve ni reemplaza cuentas con correo duplicado', async () => {
  const admin = await actor(), customer = await actor('CUSTOMER')
  for (const change of [{ email: 'inválido' }, { displayName: '' }, { passwordConfirmation: 'otra' }, { password: 'corta', passwordConfirmation: 'corta' }, { reason: '' }]) {
    await assert.rejects(register(admin.id, { ...input(), ...change }), error => error.status === 400)
  }
  const before = await db.user.findUnique({ where: { id: customer.id } })
  await assert.rejects(register(admin.id, { ...input(), email: ` ${customer.email.toUpperCase()} ` }), error => error.status === 409)
  assert.deepEqual(await db.user.findUnique({ where: { id: customer.id } }), before)
  assert.equal(await db.auditEvent.count({ where: { actorId: admin.id } }), 0)
})

test('un fallo de auditoría revierte también la creación del administrador', async () => {
  const admin = await actor(), body = input()
  const failingDb = { $transaction: operation => db.$transaction(tx => operation(new Proxy(tx, { get(target, key) {
    if (key === 'auditEvent') return { create: async () => { throw Error('Auditoría no disponible') } }
    const value = target[key]
    return typeof value === 'function' ? value.bind(target) : value
  } }))) }
  await assert.rejects(createAdministratorRegistration(failingDb)(admin.id, body), /Auditoría no disponible/)
  assert.equal(await db.user.count({ where: { emailNormalized: body.email } }), 0)
})
