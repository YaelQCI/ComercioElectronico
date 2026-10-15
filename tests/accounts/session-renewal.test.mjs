import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionFetch } from '../../app/features/accounts/session-renewal.js'

const origin = 'https://tienda.example'
function fixture() {
  let time = 1000000, expires = time - 1, refreshStatus = 200, sessionStatus = 200, refreshAvailable = true, tail = Promise.resolve()
  const calls = []
  const lock = task => { const result = tail.then(task); tail = result.catch(() => {}); return result }
  const fetch = async (input, options) => {
    const path = new URL(typeof input === 'string' ? input : input.url, origin).pathname
    calls.push({ path, options })
    if (path === '/api/account/session') return Response.json({ user: expires > time ? { id: 'cuenta' } : null, accessExpiresAt: expires > time ? new Date(expires).toISOString() : null, refreshAvailable }, { status: sessionStatus })
    if (path === '/api/account/refresh') { if (refreshStatus === 200) expires = time + 900000; return Response.json({}, { status: refreshStatus }) }
    return Response.json({ ok: true })
  }
  return { calls, lock, fetch, now: () => time, advance: ms => { time += ms }, setRefresh: status => { refreshStatus = status }, setSession: status => { sessionStatus = status }, anonymous: () => { refreshAvailable = false } }
}

test('renueva una sola vez para peticiones simultáneas y envía cada mutación solo una vez', async () => {
  const env = fixture(), client = createSessionFetch({ ...env, origin })
  await Promise.all(Array.from({ length: 5 }, () => client.fetch('/api/admin/catalog', { method: 'POST', body: 'datos' })))
  assert.equal(env.calls.filter(c => c.path.endsWith('/refresh')).length, 1)
  assert.equal(env.calls.filter(c => c.path === '/api/admin/catalog').length, 5)
  assert.equal(env.calls.find(c => c.path.endsWith('/refresh')).options.credentials, 'same-origin')
  env.advance(901000)
  await client.fetch('/api/admin/catalog')
  assert.equal(env.calls.filter(c => c.path.endsWith('/refresh')).length, 2)
})

test('dos pestañas vuelven a comprobar la cookie bajo el bloqueo y no reutilizan la renovación', async () => {
  const env = fixture(), first = createSessionFetch({ ...env, origin }), second = createSessionFetch({ ...env, origin })
  await Promise.all([first.fetch('/api/orders'), second.fetch('/api/orders')])
  assert.equal(env.calls.filter(c => c.path.endsWith('/refresh')).length, 1)
})

test('una sesión caducada termina sin bucle y un visitante anónimo no intenta renovar', async () => {
  const env = fixture(); env.setRefresh(401)
  const values = [], client = createSessionFetch({ ...env, origin, onSession: session => values.push(session) })
  await client.fetch('/api/catalog/products'); await client.fetch('/api/catalog/products')
  assert.equal(values.at(-1).user, null)
  assert.equal(env.calls.filter(c => c.path.endsWith('/refresh')).length, 1)
  const guest = fixture(); guest.anonymous()
  await createSessionFetch({ ...guest, origin }).fetch('/api/cart')
  assert.equal(guest.calls.filter(c => c.path.endsWith('/refresh')).length, 0)
})

test('fallos temporales permiten reintentar sin enviar ni repetir la operación de negocio', async () => {
  const env = fixture(); env.setRefresh(503)
  const client = createSessionFetch({ ...env, origin })
  await assert.rejects(client.fetch('/api/admin/catalog', { method: 'POST' }))
  assert.equal(env.calls.filter(c => c.path === '/api/admin/catalog').length, 0)
  env.setRefresh(200)
  await client.fetch('/api/admin/catalog', { method: 'POST' })
  assert.equal(env.calls.filter(c => c.path === '/api/admin/catalog').length, 1)
})

test('no intercepta recursos externos, no renueva sin Web Locks ni para login/logout', async () => {
  const env = fixture(), client = createSessionFetch({ ...env, origin, lock: undefined })
  await client.fetch('https://otro.example/pago')
  await client.fetch('/api/account/login', { method: 'POST' })
  await client.fetch('/api/account/logout', { method: 'POST' })
  assert.equal(env.calls.filter(c => c.path.endsWith('/session')).length, 0)
  await client.fetch('/api/cart')
  assert.equal(env.calls.filter(c => c.path.endsWith('/refresh')).length, 0)
})

test('renovación manual y automática simultáneas comparten bloqueo y no rotan dos veces', async () => {
  const env = fixture(), client = createSessionFetch({ ...env, origin })
  await Promise.all([client.fetch('/api/orders'), client.fetch('/api/account/refresh', { method: 'POST' })])
  assert.equal(env.calls.filter(c => c.path.endsWith('/refresh')).length, 1)
})

test('vencimiento entre comprobación y petición se recupera una vez; un 401 de negocio no se repite', async () => {
  const env = fixture()
  let attempted = 0
  const client = createSessionFetch({ ...env, origin, fetch: async (input, options) => {
    const path = new URL(input, origin).pathname
    if (path === '/api/protected' && attempted++ === 0) { env.advance(901000); return Response.json({}, { status: 401 }) }
    if (path === '/api/denied') return Response.json({}, { status: 401 })
    return env.fetch(input, options)
  } })
  assert.equal((await client.fetch('/api/protected', { method: 'POST', body: 'datos' })).status, 200)
  assert.equal(attempted, 2)
  const rotations = env.calls.filter(c => c.path.endsWith('/refresh')).length
  assert.equal((await client.fetch('/api/denied')).status, 401)
  assert.equal(env.calls.filter(c => c.path.endsWith('/refresh')).length, rotations)
})
