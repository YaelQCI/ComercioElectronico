import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { withInventoryTransaction } from '../../server/features/inventory/inventory-transaction.js'
import { reserveCoupon, consumeCoupon, releaseCoupon } from '../../server/features/coupons/coupon-reservations.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar base aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
test.after(() => db.$disconnect())
const run = action => withInventoryTransaction(db, action)
async function fixture(coupon, email = 'fixture@example.invalid', expired = false) {
  const variant = await db.productVariant.findFirst()
  return db.$transaction(async tx => {
    const order = await tx.order.create({ data: { orderNumber: randomUUID(), buyerEmail: email, buyerEmailNormalized: email.trim().toLowerCase(), buyerName: 'Fixture', couponId: coupon.id, couponSnapshot: { version: coupon.version }, goodsBeforeCouponCents: 1000n, couponDiscountCents: 1000n, goodsAfterCouponCents: 0n, pointsAppliedTenths: 0n, goodsMoneyCents: 0n, shippingQuotedCents: 0n, shippingChargedCents: 0n, shippingSubsidyCents: 0n, totalMoneyCents: 0n, policySnapshot: {} } })
    const line = await tx.orderLine.create({ data: { orderId: order.id, position: 0, variantId: variant.id, kind: 'VARIANT', quantity: 1, nameSnapshot: 'Fixture', skuOrCodeSnapshot: 'Fixture', unitPriceCents: 1000n, lineBeforeCouponCents: 1000n, couponDiscountCents: 1000n, lineAfterCouponCents: 0n } })
    const component = await tx.orderComponent.create({ data: { orderId: order.id, orderLineId: line.id, variantId: variant.id, quantityPerLineUnit: 1, totalQuantity: 1, productSnapshot: { id: variant.productId, categoryIds: [] }, variantSnapshot: { compareAtPriceCents: null }, referenceUnitPriceCents: 1000n, allocatedBaseCents: 1000n, allocatedCouponCents: 1000n, allocatedNetCents: 0n } })
    await tx.orderUnit.create({ data: { orderId: order.id, orderComponentId: component.id, variantId: variant.id, unitOrdinal: 1, baseCents: 1000n, couponCents: 1000n, netGoodsCents: 0n, pointsTenths: 0n, moneyCents: 0n } })
    const quote = await tx.shippingQuote.create({ data: { orderId: order.id, requestFingerprint: randomUUID(), carrierCode: 'FIXTURE', serviceCode: 'FIXTURE', serviceName: 'Fixture', quotedAmountCents: 0n, originSnapshot: {}, destinationSnapshot: {}, packageSnapshot: {}, sanitizedResponse: {} } })
    const createdAt = new Date(Date.now() - (expired ? 31 : 0) * 60000)
    return tx.reservationSet.create({ data: { orderId: order.id, attemptNumber: 1, createdAt, expiresAt: new Date(createdAt.getTime() + 29 * 60000), acceptedQuoteId: quote.id, checkoutFingerprint: randomUUID(), acceptedCheckoutSnapshot: {}, idempotencyKey: randomUUID() } })
  })
}
async function coupon(extra = {}) {
  const code = `fixture-${randomUUID()}`
  return db.coupon.create({ data: { code, codeNormalized: code, kind: 'FIXED', fixedAmountCents: 1000n, ...extra } })
}
test('último uso concurrente solo se reserva una vez; liberar permite otra reserva y consumir es idempotente', async () => {
  const c = await coupon({ maxUses: 1 }), a = await fixture(c), b = await fixture(c, 'other@example.invalid')
  const results = await Promise.allSettled([a,b].map(r => run(ctx => reserveCoupon(ctx, r.id))))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const winner = results[0].status === 'fulfilled' ? a : b, loser = winner === a ? b : a
  assert.equal((await run(ctx => reserveCoupon(ctx, winner.id))).state, 'RESERVED')
  await run(ctx => releaseCoupon(ctx, winner.id))
  await run(ctx => reserveCoupon(ctx, loser.id))
  await run(ctx => consumeCoupon(ctx, loser.id))
  assert.equal((await run(ctx => consumeCoupon(ctx, loser.id))).state, 'CONSUMED')
  await assert.rejects(run(ctx => releaseCoupon(ctx, loser.id)), /liberarse/)
  assert.equal(await db.couponUsage.count({ where: { couponId: c.id, state: 'CONSUMED' } }), 1)
})
test('límite por correo normalizado y barrera de reconciliación no dependen de identidad del navegador', async () => {
  const c = await coupon({ maxUsesPerCustomer: 1 }), a = await fixture(c, 'Fixture@Example.invalid'), b = await fixture(c)
  await run(ctx => reserveCoupon(ctx, a.id))
  await assert.rejects(run(ctx => reserveCoupon(ctx, b.id)), /límite/)
  const payment = await db.paymentAttempt.create({ data: { orderId: a.orderId, reservationSetId: a.id, amountCents: 100n, idempotencyKey: randomUUID(), status: 'PENDING' } })
  await assert.rejects(run(ctx => releaseCoupon(ctx, a.id)), /Reconciliar/)
  await db.paymentAttempt.update({ where: { id: payment.id }, data: { status: 'FAILED', lastReconciledAt: new Date() } })
  await run(ctx => releaseCoupon(ctx, a.id))
  assert.equal((await run(ctx => reserveCoupon(ctx, b.id))).state, 'RESERVED')
})
test('reserva vencida no crea uso y una selección de cupón modificada exige nueva aceptación', async () => {
  const c = await coupon(), expired = await fixture(c, 'fixture@example.invalid', true), current = await fixture(c)
  await assert.rejects(run(ctx => reserveCoupon(ctx, expired.id)), /vencida/)
  await db.coupon.update({ where: { id: c.id }, data: { version: { increment: 1 } } })
  await assert.rejects(run(ctx => reserveCoupon(ctx, current.id)), /cambió/)
  assert.equal(await db.couponUsage.count({ where: { couponId: c.id } }), 0)
})
