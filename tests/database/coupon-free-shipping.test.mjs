import test from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { paymentFixture, fakeStripe } from './payment-fixture.mjs'
import { createOrderPayments } from '../../server/features/payments/order-payments.js'
import { createShippingQuotes } from '../../server/features/shipping/shipping-quotes.js'
import { createCouponAdministration } from '../../server/features/coupons/manage-coupons.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
const options = { quantity: 1, priceCents: '50000', shippingCents: '15000', coupon: { fixedAmountCents: 49000n, freeShipping: true } }

test('producto de $500 con cupón: $10 al proveedor, envío bonificado y consumo atómico', async () => {
  const f = await paymentFixture(db, options), stripe = fakeStripe(), payments = createOrderPayments(db, stripe, f.shipping)
  assert.equal(f.total, '1000')
  const cart = await f.cartService.read(f.owner)
  assert.equal(cart.coupon.freeShipping, true)
  const selected = await createShippingQuotes(db, f.shipping).selected(f.owner)
  assert.equal(selected.chargedAmountCents, '0')
  assert.equal(selected.subsidyCents, '15000')
  const order = await db.order.findUnique({ where: { id: f.prepared.orderId } })
  assert.equal(order.couponSnapshot.freeShipping, true)
  assert.equal(order.couponDiscountCents, 49000n)
  assert.equal(order.shippingSubsidyCents, 15000n)
  await assert.rejects(db.order.update({ where: { id: order.id }, data: { couponSnapshot: { ...order.couponSnapshot, freeShipping: false } } }))
  await payments.start(order.id, f.identity, '1000')
  const attempt = await db.paymentAttempt.findFirst({ where: { orderId: order.id } })
  assert.equal(stripe.sessions.get(attempt.providerSessionId).amountCents, '1000')
  stripe.paid(attempt.providerSessionId)
  await payments.reconcile(attempt.id)
  assert.equal((await payments.status(order.id, f.identity)).status, 'CONFIRMED')
  assert.equal((await db.couponUsage.findFirst({ where: { orderId: order.id } })).state, 'CONSUMED')
})

test('quitar o editar la bonificación invalida la cotización y exige aceptar un pedido nuevo', async () => {
  const f = await paymentFixture(db, options), quotes = createShippingQuotes(db, f.shipping), cart = await f.cartService.read(f.owner)
  const coupon = await db.coupon.findUnique({ where: { id: cart.coupon.id } })
  const service = createCouponAdministration(db)
  const input = { code: coupon.code, kind: 'FIXED', fixedAmountCents: '49000', scope: 'CATALOG', isActive: true, allowOffers: false, allowBundles: false, freeShipping: false, expectedVersion: coupon.version, reason: 'Cambio sintético de envío' }
  const saved = await service.save(f.admin.id, input, coupon.id)
  assert.equal(saved.coupon.freeShipping, false)
  assert.equal(await quotes.selected(f.owner), null)
  const stripe = fakeStripe()
  await assert.rejects(createOrderPayments(db, stripe, f.shipping).start(f.prepared.orderId, f.identity, '1000'), e => e.status === 409)
  assert.equal(stripe.sessions.size, 0)
  const removed = await f.cartService.coupon(f.owner, { version: cart.version, remove: true })
  assert.equal(removed.coupon, null)
  assert.equal(removed.totals.goodsAfterCouponCents, '50000')
  const audit = await db.auditEvent.findFirst({ where: { entityId: coupon.id, action: 'UPDATE_COUPON' } })
  assert.equal(audit.safeAfter.freeShipping, false)
})
