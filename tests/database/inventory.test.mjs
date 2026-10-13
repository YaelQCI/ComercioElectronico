import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { reserveInventory, consumeInventory, releaseInventory } from '../../server/features/inventory/inventory-reservations.js'
import { adjustInventory } from '../../server/features/inventory/adjust-inventory.js'
import { withInventoryTransaction } from '../../server/features/inventory/inventory-transaction.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar únicamente base aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
test.after(() => db.$disconnect())
const run = callback => withInventoryTransaction(db, callback)
test('sesión Prisma UTC conserva instantes y el reloj coincide con epoch PostgreSQL', async () => {
  const [clock] = await db.$queryRaw`SELECT current_setting('TimeZone') AS zone, clock_timestamp() AS now, extract(epoch FROM clock_timestamp()) * 1000 AS epoch`
  assert.equal(clock.zone, 'UTC')
  assert.ok(Math.abs(clock.now.getTime() - Number(clock.epoch)) < 10)
  assert.ok(Math.abs(clock.now.getTime() - Date.now()) < 3000)
  const at = new Date('2026-10-13T18:00:00.123Z')
  const product = await db.product.create({ data: { name: 'Fixture UTC', slug: `fixture-utc-${randomUUID()}`, description: 'Prueba de instante', publishedAt: at } })
  const [stored] = await db.$queryRaw`SELECT extract(epoch FROM "publishedAt") * 1000 AS epoch FROM "Product" WHERE id = ${product.id}::uuid`
  assert.equal(Number(stored.epoch), at.getTime())
})
async function catalogFixture(quantity = 3) {
  const token = randomUUID(), warehouse = await db.warehouse.findFirst()
  assert.ok(warehouse, 'Primero ejecutar fixtures de migración en base aislada.')
  const product = await db.product.create({ data: { name: 'Fixture inventario', slug: `fixture-inventory-${token}`, description: 'No comercial', publishedAt: new Date() } })
  const variant = await db.productVariant.create({ data: { productId: product.id, sku: `FIX-INVENTORY-${token}`, flavor: 'Neutro', flavorNormalized: 'neutro', presentationLabel: 'Fixture', presentationNormalized: 'fixture', contentAmount: '1', contentUnit: 'g', priceCents: 0n, weightGrams: 1, lengthMm: 1, widthMm: 1, heightMm: 1 } })
  const lot = await db.inventoryLot.create({ data: { variantId: variant.id, warehouseId: warehouse.id, lotCode: token, expiresOn: new Date('2030-01-31T00:00:00Z'), expiryPrecision: 'MONTH' } })
  await db.inventoryMovement.create({ data: { lotId: lot.id, kind: 'RECEIPT', onHandDelta: quantity, actorType: 'SYSTEM', reason: 'Fixture de pruebas', idempotencyKey: randomUUID() } })
  return { product, variant, lot }
}
async function orderFixture(variantId, quantity = 1, expired = false) {
  return db.$transaction(async tx => {
    const order = await tx.order.create({ data: { orderNumber: randomUUID(), buyerEmail: 'fixture@example.invalid', buyerEmailNormalized: 'fixture@example.invalid', buyerName: 'Fixture', goodsBeforeCouponCents: 0n, couponDiscountCents: 0n, goodsAfterCouponCents: 0n, pointsAppliedTenths: 0n, goodsMoneyCents: 0n, shippingQuotedCents: 0n, shippingChargedCents: 0n, shippingSubsidyCents: 0n, totalMoneyCents: 0n, policySnapshot: {} } })
    const line = await tx.orderLine.create({ data: { orderId: order.id, position: 0, variantId, kind: 'VARIANT', quantity, nameSnapshot: 'Fixture', skuOrCodeSnapshot: 'Fixture', unitPriceCents: 0n, lineBeforeCouponCents: 0n, couponDiscountCents: 0n, lineAfterCouponCents: 0n } })
    const component = await tx.orderComponent.create({ data: { orderId: order.id, orderLineId: line.id, variantId, quantityPerLineUnit: 1, totalQuantity: quantity, productSnapshot: {}, variantSnapshot: {}, referenceUnitPriceCents: 0n, allocatedBaseCents: 0n, allocatedCouponCents: 0n, allocatedNetCents: 0n } })
    for (let i = 1; i <= quantity; i++) await tx.orderUnit.create({ data: { orderId: order.id, orderComponentId: component.id, variantId, unitOrdinal: i, baseCents: 0n, couponCents: 0n, netGoodsCents: 0n, pointsTenths: 0n, moneyCents: 0n } })
    const quote = await tx.shippingQuote.create({ data: { orderId: order.id, requestFingerprint: randomUUID(), carrierCode: 'FIXTURE', serviceCode: 'FIXTURE', serviceName: 'Fixture', quotedAmountCents: 0n, originSnapshot: {}, destinationSnapshot: {}, packageSnapshot: {}, sanitizedResponse: {} } })
    const createdAt = new Date(Date.now() - (expired ? 31 : 0) * 60000)
    const reservation = await tx.reservationSet.create({ data: { orderId: order.id, attemptNumber: 1, createdAt, expiresAt: new Date(createdAt.getTime() + 29 * 60000), acceptedQuoteId: quote.id, checkoutFingerprint: randomUUID(), acceptedCheckoutSnapshot: {}, idempotencyKey: randomUUID() } })
    return { order, reservation }
  })
}
test('dos reservas concurrentes del último lote: solo una consigue stock', async () => {
  const f = await catalogFixture(1), a = await orderFixture(f.variant.id), b = await orderFixture(f.variant.id)
  const outcomes = await Promise.allSettled([run(tx => reserveInventory(tx, a.reservation.id)), run(tx => reserveInventory(tx, b.reservation.id))])
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(outcomes.find(r => r.status === 'rejected').reason.code, 'INSUFFICIENT_STOCK')
  const lot = await db.inventoryLot.findUnique({ where: { id: f.lot.id } })
  assert.equal(lot.reservedQty, 1); assert.equal(lot.onHandQty, 1)
  const winner = outcomes[0].status === 'fulfilled' ? a : b
  await run(tx => releaseInventory(tx, winner.reservation.id, 'Fin de prueba sin intento de pago'))
})
test('reserva/consumo cero idempotentes, asignación por unidad y ledger sin doble venta', async () => {
  const f = await catalogFixture(3), o = await orderFixture(f.variant.id, 2)
  await run(tx => reserveInventory(tx, o.reservation.id))
  await run(tx => reserveInventory(tx, o.reservation.id))
  const units = await db.orderUnit.findMany({ where: { orderId: o.order.id } })
  assert.ok(units.every(u => u.lotId === f.lot.id && u.lotSnapshot.lotCode === f.lot.lotCode))
  await run(tx => consumeInventory(tx, o.reservation.id))
  assert.equal((await run(tx => consumeInventory(tx, o.reservation.id))).alreadyConsumed, true)
  const lot = await db.inventoryLot.findUnique({ where: { id: f.lot.id } })
  assert.equal(lot.onHandQty, 1); assert.equal(lot.reservedQty, 0)
  assert.equal(await db.inventoryMovement.count({ where: { lotId: lot.id, kind: 'SALE' } }), 2)
})
test('reservas vencidas no reservan y liberación se deduplica; pago pendiente impide liberación', async () => {
  const f = await catalogFixture(2), expired = await orderFixture(f.variant.id, 1, true)
  await assert.rejects(run(tx => reserveInventory(tx, expired.reservation.id)), e => e.code === 'RESERVATION_UNAVAILABLE')
  const o = await orderFixture(f.variant.id)
  await run(tx => reserveInventory(tx, o.reservation.id))
  const payment = await db.paymentAttempt.create({ data: { orderId: o.order.id, reservationSetId: o.reservation.id, amountCents: 100n, idempotencyKey: randomUUID() } })
  await assert.rejects(run(tx => releaseInventory(tx, o.reservation.id, 'Prueba')), e => e.code === 'PAYMENT_RECONCILIATION_REQUIRED')
  await db.paymentAttempt.update({ where: { id: payment.id }, data: { status: 'FAILED', lastReconciledAt: new Date() } })
  await run(tx => releaseInventory(tx, o.reservation.id, 'Prueba reconciliada'))
  assert.equal((await run(tx => releaseInventory(tx, o.reservation.id, 'Prueba reconciliada'))).alreadyReleased, true)
  assert.equal((await db.inventoryLot.findUnique({ where: { id: f.lot.id } })).reservedQty, 0)
})
test('ajuste solo admin con motivo e idempotencia; no retira piezas reservadas', async () => {
  const f = await catalogFixture(2), o = await orderFixture(f.variant.id)
  await run(tx => reserveInventory(tx, o.reservation.id))
  const token = randomUUID(), admin = await db.user.create({ data: { email: `${token}@example.invalid`, emailNormalized: `${token}@example.invalid`, passwordHash: 'fixture-not-a-real-credential', displayName: 'Fixture', role: 'ADMIN' } })
  const options = { lotId: f.lot.id, delta: -2, reason: 'Fixture', actorId: admin.id, idempotencyKey: randomUUID() }
  await assert.rejects(run(tx => adjustInventory(tx, options)), e => e.code === 'INSUFFICIENT_UNRESERVED_STOCK')
  options.delta = -1
  const first = await run(tx => adjustInventory(tx, options)), second = await run(tx => adjustInventory(tx, options))
  assert.equal(first.id, second.id)
  await db.user.update({ where: { id: admin.id }, data: { role: 'CUSTOMER' } })
  await assert.rejects(run(tx => adjustInventory(tx, { ...options, delta: 1, idempotencyKey: randomUUID() })), e => e.code === 'FORBIDDEN')
  await run(tx => releaseInventory(tx, o.reservation.id, 'Fin de prueba'))
})
