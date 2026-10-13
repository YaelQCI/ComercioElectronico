import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
const base = process.env.TEST_HTTP_URL, url = process.env.TEST_DATABASE_URL
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) || !url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar servidor local conectado a TEST_DATABASE_URL aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
try {
  const slug = `fixture-http-restock-${randomUUID()}`
  const product = await db.product.create({ data: { name: 'Fixture HTTP de reposición', slug, description: 'Prueba aislada', publishedAt: new Date() } })
  const variant = await db.productVariant.create({ data: { productId: product.id, sku: slug.toUpperCase(), flavor: 'Neutro', flavorNormalized: 'neutro', presentationLabel: 'Fixture', presentationNormalized: 'fixture', contentAmount: '1', contentUnit: 'g', priceCents: 1000n, weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 } })
  const input = { variantId: variant.id, email: `fixture-${randomUUID()}@example.invalid`, consent: true }
  const post = (path, body, origin = base) => fetch(`${base}${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await post('/api/restock', input, 'https://example.invalid')).status, 403)
  assert.equal((await post('/api/restock', { ...input, email: 'invalid' })).status, 400)
  assert.equal((await post('/api/restock', { ...input, consent: false })).status, 400)
  const registered = await post('/api/restock', input)
  assert.equal(registered.status, 200)
  const result = await registered.json()
  assert.equal(result.subscribed, true)
  assert.match(result.message, /pendiente/)
  assert.ok(result.cancelPath.includes('#token='))
  const duplicate = await post('/api/restock', input)
  assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).cancelPath, null)
  const htmlResponse = await fetch(`${base}/producto/${product.id}`)
  assert.equal(htmlResponse.status, 200)
  assert.match(await htmlResponse.text(), /Avisarme cuando llegue/)
  const cancelPage = await fetch(`${base}/avisos/cancelar`)
  assert.equal(cancelPage.status, 200); assert.match(await cancelPage.text(), /Cancelar aviso de reposición/)
  const token = new URLSearchParams(result.cancelPath.split('#')[1]).get('token')
  const cancel = await post('/api/restock/cancel', { token })
  assert.equal(cancel.status, 200); assert.equal((await cancel.json()).canceled, true)
  assert.equal((await post('/api/restock/cancel', { token })).status, 200)
  assert.equal((await post('/api/restock/cancel', { token: 'invalid' })).status, 400)
  assert.equal(await db.outboxMessage.count({ where: { aggregateType: 'RestockSubscription', payload: { path: ['variantId'], equals: variant.id } } }), 0)
  console.log('HTTP/SSR reposición: validación, origen, registro, duplicado, ficha y cancelación aprobados. Sin envío de correos.')
} finally { await db.$disconnect() }
