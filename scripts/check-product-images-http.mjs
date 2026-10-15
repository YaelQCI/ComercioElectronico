import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from '../server/features/accounts/credentials.js'

const database = process.env.TEST_DATABASE_URL, base = process.env.TEST_HTTP_URL
if (!database || new URL(database).pathname !== '/fitness_migration_test_docker' || base !== 'http://fitness-product-images-check:3000') throw Error('Esta comprobación requiere servidor y base Docker de pruebas aislados.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: database }) })
const cookieJars = { admin: '', customer: '' }
async function request(path, { body, method = 'GET', user, origin = base } = {}) {
  const form = body instanceof FormData
  const response = await fetch(base+path, { method, headers: { Origin: origin, ...(user ? { Cookie: cookieJars[user] } : {}), ...(body && !form ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: form ? body : JSON.stringify(body) } : {}) })
  if (user && response.headers.getSetCookie().length) cookieJars[user] = response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
  return response
}
try {
  let ready = false
  for (let i=0; i<100; i++) {
    try { if ((await request('/api/health')).ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(ready, 'Servidor aislado no disponible')
  const password = 'Contraseña sintética 123', passwordHash = await hashPassword(password)
  for (const [user, role] of [['admin', 'ADMIN'], ['customer', 'CUSTOMER']]) {
    const email = `${randomUUID()}@example.invalid`
    await db.user.create({ data: { email, emailNormalized: email, displayName: 'Prueba sintética de imágenes', role, passwordHash } })
    const login = await request('/api/account/login', { user, method: 'POST', body: { email, password } })
    assert.equal(login.status, 200)
  }
  const code = randomUUID(), created = await request('/api/admin/catalog', { user: 'admin', method: 'POST', body: { name: 'Producto sintético HTTP', slug: code, description: 'Solo pruebas aisladas', reason: 'Fixture', variants: [{ sku: code.toUpperCase(), flavor: 'Fixture', presentationLabel: 'Fixture', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 }] } })
  assert.equal(created.status, 200)
  const product = await created.json(), path = `/api/admin/catalog/${product.id}/images`
  const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer()
  function form(mime = 'image/png', data = bytes) {
    const form = new FormData()
    form.append('image', new Blob([data], { type: mime }), 'imagen-sintetica.png')
    form.append('alt', 'Imagen sintética de prueba'); form.append('kind', 'FRONT'); form.append('reason', 'Fixture HTTP')
    return form
  }
  assert.equal((await request(path, { method: 'POST', body: form() })).status, 401)
  assert.equal((await request(path, { user: 'customer', method: 'POST', body: form() })).status, 403)
  assert.equal((await request(path, { user: 'admin', origin: 'https://example.invalid', method: 'POST', body: form() })).status, 403)
  assert.equal((await request(path, { user: 'admin', method: 'POST', body: form('image/svg+xml', Buffer.from('<svg/>')) })).status, 415)
  assert.equal((await request(path, { user: 'admin', method: 'POST', body: form('image/png', Buffer.from('imagen dañada')) })).status, 400)
  assert.equal((await request(path, { user: 'admin', method: 'POST', body: form('image/png', Buffer.alloc(6*1024*1024)) })).status, 413)
  const uploaded = await request(path, { user: 'admin', method: 'POST', body: form() })
  assert.equal(uploaded.status, 200, await uploaded.clone().text())
  const image = await uploaded.json()
  assert.equal((await request(image.url)).status, 404)
  assert.equal((await request(image.url, { user: 'customer' })).status, 404)
  assert.equal((await request(image.url, { user: 'admin' })).status, 200)
  const publish = await request(`/api/admin/catalog/${product.id}`, { user: 'admin', method: 'PATCH', body: { published: true, reason: 'Publicación sintética de prueba' } })
  assert.equal(publish.status, 200)
  const publicImage = await request(image.url)
  assert.equal(publicImage.status, 200); assert.equal(publicImage.headers.get('content-type'), 'image/webp')
  assert.equal((await sharp(Buffer.from(await publicImage.arrayBuffer())).metadata()).format, 'webp')
  const catalog = await request(`/api/catalog/products/${product.id}`)
  assert.equal(catalog.status, 200)
  assert.ok((await catalog.text()).includes(image.url))
  console.log('HTTP aislado: carga multipart, validación de archivos/límites, permisos, Origin, imagen privada del borrador y publicación con imagen pública correctos. Sin modificar la tienda.')
} finally {
  for (const user of Object.keys(cookieJars)) if (cookieJars[user]) await request('/api/account/logout', { user, method: 'POST', body: {} }).catch(() => {})
  await db.$disconnect()
}
