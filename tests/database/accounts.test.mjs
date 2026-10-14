import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createAccounts } from '../../server/features/accounts/account-repository.js'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar base aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
const accounts = createAccounts(db, randomBytes(32).toString('base64'))
const fixture = () => ({ email: `${randomUUID()}@example.invalid`, displayName: 'Cuenta sintética', password: 'Contraseña sintética 123', passwordConfirmation: 'Contraseña sintética 123' })

test('registro rechaza confirmación ausente o distinta sin crear usuario', async () => {
  const input = fixture()
  for (const passwordConfirmation of [undefined, '', 'Otra contraseña', `${input.password} `]) {
    await assert.rejects(accounts.register({ ...input, passwordConfirmation }), e => e.status === 400)
    assert.equal(await db.user.count({ where: { emailNormalized: input.email } }), 0)
  }
})

test('registro cliente, duplicado normalizado, login inválido, perfil y aislamiento de direcciones', async () => {
  const input = fixture(), registered = await accounts.register({ ...input, role: 'ADMIN' })
  assert.equal(registered.user.role, 'CUSTOMER'); assert.ok(!('passwordHash' in registered.user))
  await assert.rejects(accounts.register({ ...input, email: input.email.toUpperCase() }), /registrar/)
  await assert.rejects(accounts.login({ ...input, password: 'incorrecta' }), /incorrectos/)
  const identity = await accounts.authenticate(registered.access)
  assert.equal(identity.user.id, registered.user.id)
  const updated = await accounts.updateProfile(identity.user.id, { displayName: 'Editado', phone: '0000000000', role: 'ADMIN' })
  assert.equal(updated.role, 'CUSTOMER'); assert.equal(updated.displayName, 'Editado')
  const a = { recipientName: 'Prueba', phone: '0000000000', postalCode: '01000', state: 'Prueba', city: 'Prueba', district: 'Prueba', street: 'Prueba', exteriorNumber: '1' }
  const first = await accounts.saveAddress(identity.user.id, a)
  const second = await accounts.saveAddress(identity.user.id, { ...a, isDefault: true })
  const profile = await accounts.profile(identity.user.id)
  assert.equal(profile.addresses.length, 2); assert.equal(profile.addresses.filter(a => a.isDefault).length, 1)
  const other = await accounts.register(fixture())
  await assert.rejects(accounts.saveAddress(other.user.id, { ...a, id: first.id }), /disponible/)
  assert.equal((await db.address.findUnique({ where: { id: second.id } })).isDefault, true)
})
test('renovación rota; reutilización revoca familia, logout y cambio de contraseña revocan acceso', async () => {
  const input = fixture(), original = await accounts.register(input), rotated = await accounts.refresh(original.refresh)
  assert.notEqual(rotated.refresh, original.refresh); assert.ok(await accounts.authenticate(rotated.access))
  await assert.rejects(accounts.refresh(original.refresh), /vencida/)
  assert.equal(await accounts.authenticate(rotated.access), null)
  const next = await accounts.login(input)
  await accounts.logout(await accounts.authenticate(next.access)); assert.equal(await accounts.authenticate(next.access), null)
  const expiredAccess = await accounts.login(input)
  await accounts.logout(null, expiredAccess.refresh)
  assert.equal(await accounts.authenticate(expiredAccess.access), null)
  const active = await accounts.login(input)
  await accounts.password(active.user.id, { currentPassword: input.password, password: 'Otra contraseña sintética 456' })
  assert.equal(await accounts.authenticate(active.access), null)
  await assert.rejects(accounts.refresh(active.refresh), /vencida/)
  await assert.rejects(accounts.login(input), /incorrectos/)
})
test('soft delete revoca sesiones y conserva unicidad del correo', async () => {
  const input = fixture(), original = await accounts.register(input)
  await accounts.password(original.user.id, { currentPassword: input.password }, true)
  assert.equal(await accounts.authenticate(original.access), null)
  await assert.rejects(accounts.login(input), /incorrectos/)
  await assert.rejects(accounts.register(input), /registrar/)
})
