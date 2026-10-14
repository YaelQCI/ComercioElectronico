import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar TEST_DATABASE_URL aislada.')
const origin = 'http://127.0.0.1:3051', cookieJar = new Map()
const server = spawn(process.execPath, ['.output/server/index.mjs'], { env: { ...process.env, DATABASE_URL: database, NUXT_AUTH_SECRET: randomBytes(32).toString('base64'), NITRO_PORT: '3051', NITRO_HOST: '127.0.0.1' }, stdio: 'ignore', windowsHide: true })
async function request(path, body, cookies = true, foreign = false) {
  const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { Origin: foreign ? 'https://example.invalid' : origin, 'Content-Type': 'application/json' } : {}), ...(cookies ? { Cookie: [...cookieJar].map(([k,v]) => `${k}=${v}`).join('; ') } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  if (cookies) for (const c of response.headers.getSetCookie()) { const [k,v] = c.split(';')[0].split('='); if (v) cookieJar.set(k,v); else cookieJar.delete(k) }
  return response
}
try {
  let ready = false
  for (let i = 0; i < 100; i++) { try { if ((await request('/api/health')).ok) { ready = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 200)) }
  assert.ok(ready, 'Servidor no disponible')
  const input = { email: `${randomUUID()}@example.invalid`, displayName: 'HTTP sintético', password: 'Contraseña sintética 123' }
  assert.equal((await request('/api/account/register', input, true, true)).status, 403)
  const registered = await request('/api/account/register', input)
  assert.equal(registered.status, 200)
  const cookies = registered.headers.getSetCookie()
  assert.ok(cookies.every(c => /HttpOnly/i.test(c) && /Secure/i.test(c) && /SameSite=Strict/i.test(c)))
  const account = await registered.json(); assert.equal(account.user.role, 'CUSTOMER'); assert.ok(!('access' in account))
  assert.equal((await request('/api/account/profile')).status, 200)
  assert.equal((await request('/api/account/profile', null, false)).status, 401)
  assert.equal((await request('/api/account/refresh', {})).status, 200)
  const access = cookieJar.get('fitness_access')
  assert.equal((await request('/api/account/logout', {})).status, 200)
  cookieJar.set('fitness_access', access)
  assert.equal((await request('/api/account/profile')).status, 401)
  const page = await request('/cuenta'); assert.equal(page.status, 200); assert.match(await page.text(), /Mi cuenta/)
  console.log('HTTP: alta, cookies, Origin, propiedad, renovación, revocación y SSR de cuenta correctos.')
} finally { server.kill() }
