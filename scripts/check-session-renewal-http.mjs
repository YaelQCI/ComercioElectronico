import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createAccounts } from '../server/features/accounts/account-repository.js'
import { createSessionFetch } from '../app/features/accounts/session-renewal.js'

const url = process.env.TEST_DATABASE_URL, origin = process.env.TEST_HTTP_ORIGIN
if (!url || new URL(url).pathname !== '/fitness_migration_test_docker' || origin !== 'http://fitness-session-check:3000') throw new Error('Solo entorno HTTP y base aislados.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
try {
  const registered = await createAccounts(db, randomBytes(32).toString('base64')).register({ email: `${randomUUID()}@example.invalid`, displayName: 'Sesión sintética', password: 'Contraseña sintética 123', passwordConfirmation: 'Contraseña sintética 123' })
  const jar = new Map([['fitness_refresh', registered.refresh]])
  let rotations = 0, tail = Promise.resolve()
  const lock = task => { const result = tail.then(task); tail = result.catch(() => {}); return result }
  const transport = async (input, options = {}) => {
    const headers = new Headers(options.headers)
    headers.set('Cookie', [...jar].map(([key, value]) => `${key}=${value}`).join('; '))
    headers.set('Origin', origin)
    const target = new URL(input, origin)
    if (target.pathname.endsWith('/refresh')) rotations++
    const response = await fetch(target, { ...options, headers })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'), at = pair.indexOf('=')
      const key = pair.slice(0, at), value = pair.slice(at + 1)
      if (!value) jar.delete(key); else jar.set(key, value)
    }
    return response
  }
  const first = createSessionFetch({ fetch: transport, origin, lock }), second = createSessionFetch({ fetch: transport, origin, lock })
  const responses = await Promise.all([first.fetch('/api/account/profile'), first.fetch('/api/account/profile'), second.fetch('/api/account/profile')])
  assert.ok(responses.every(response => response.status === 200))
  assert.equal(rotations, 1)
  assert.notEqual(jar.get('fitness_refresh'), registered.refresh)
  const stored = await db.authSession.findFirst({ where: { userId: registered.user.id } })
  assert.equal(stored.absoluteExpiresAt.toISOString(), registered.expiresAt.toISOString())
  jar.delete('fitness_access')
  const saved = await first.fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'Sesión recuperada', phone: '' }) })
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).user.displayName, 'Sesión recuperada')
  assert.equal(rotations, 2)
  assert.equal((await first.fetch('/api/account/logout', { method: 'POST' })).status, 200)
  assert.equal((await first.fetch('/api/account/profile')).status, 401)
  assert.equal(rotations, 2)
  console.log('HTTP: recuperación, concurrencia, rotación, límite absoluto, edición tras expirar y logout correctos.')
} finally { await db.$disconnect() }
