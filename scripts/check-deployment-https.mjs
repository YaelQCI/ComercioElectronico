import assert from 'node:assert/strict'
import https from 'node:https'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const url = new URL(process.env.TEST_DEPLOYMENT_URL || 'https://localhost:8443')
if (process.env.TEST_DEPLOYMENT_ISOLATED !== 'true' || url.protocol !== 'https:' || url.hostname !== 'localhost' || url.port !== '8443' || !process.env.TEST_DEPLOYMENT_CA) throw Error('Requiere el entorno efímero de check-ec2-compose.sh; no usar contra la tienda.')
const ca = await readFile(process.env.TEST_DEPLOYMENT_CA)
async function request(path, method = 'GET', body, cookie, origin = url.origin) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: '127.0.0.1', port: url.port, servername: 'localhost', ca, path, method, headers: { Host: url.host, Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, response => {
      let data = ''
      response.on('data', chunk => { data += chunk })
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, data }))
    })
    req.setTimeout(15000, () => req.destroy(Error('Tiempo de espera agotado')))
    req.on('error', reject)
    req.end(body ? JSON.stringify(body) : undefined)
  })
}
assert.equal((await request('/api/health')).status, 200)
const email = `deployment-${randomUUID()}@example.invalid`
const password = `Synthetic-${randomUUID()}`
const registration = await request('/api/account/register', 'POST', { email, password, passwordConfirmation: password, displayName: 'DEMO: comprobación efímera de CI' })
assert.equal(registration.status, 200, registration.data)
assert.ok(registration.headers['set-cookie'].every(cookie => /; Secure(?:;|$)/i.test(cookie)))
const cookie = registration.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ')
const session = await request('/api/account/session', 'GET', null, cookie)
assert.equal(JSON.parse(session.data).user.email, email)
assert.equal((await request('/api/account/login', 'POST', { email, password }, null, 'https://otro.example.invalid')).status, 403)
assert.equal((await request('/api/account/login', 'POST', { email, password })).status, 200)
console.log('HTTPS aislado: certificado verificado, salud, origen, registro, login y sesión Secure correctos. Sin usuarios reales.')
