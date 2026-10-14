import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { emailAddress, hashPassword, verifyPassword, issueAccess, verifyAccess } from '../../server/features/accounts/credentials.js'

test('normaliza sin eliminar puntos ni etiquetas; rechaza entradas y contraseñas débiles', async () => {
  assert.equal(emailAddress(' A.B+tag@Example.Invalid '), 'a.b+tag@example.invalid')
  assert.throws(() => emailAddress('a b@example.invalid'))
  await assert.rejects(hashPassword('corta'))
  const password = 'Contraseña de pruebas 123', hash = await hashPassword(password)
  assert.ok(!hash.includes(password)); assert.equal(await verifyPassword(password, hash), true)
  assert.equal(await verifyPassword('otra contraseña', hash), false)
  assert.equal(await verifyPassword(password, null), false)
})
test('JWT rechaza firma alterada, vencimiento, clave inválida y audiencias externas', () => {
  const secret = randomBytes(32).toString('base64'), now = Date.now(), user = { id: randomUUID(), authVersion: 2 }, session = { id: randomUUID(), absoluteExpiresAt: new Date(now + 86400000) }
  const token = issueAccess(user, session, secret, now)
  assert.equal(verifyAccess(token, secret, now).sub, user.id)
  assert.equal(verifyAccess(token, secret, now + 900000), null)
  assert.equal(verifyAccess(token.slice(0, -3) + 'xyz', secret, now), null)
  assert.equal(verifyAccess(token, randomBytes(32).toString('base64'), now), null)
  assert.throws(() => issueAccess(user, session, ''))
  assert.equal(verifyAccess('e30.e30.e30', secret), null)
})
