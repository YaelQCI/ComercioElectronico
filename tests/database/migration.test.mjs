import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) {
  throw new Error('TEST_DATABASE_URL debe apuntar a una base aislada fitness_migration_test*. Nunca usar la base de la tienda.')
}
const pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 })
test.after(() => pool.end())
const stamp = () => new Date()

async function insert(client, table, values) {
  const data = { id: randomUUID(), createdAt: stamp(), updatedAt: stamp(), ...values }
  if (ledgers.has(table)) delete data.updatedAt
  // Only fixture code supplies table/field names; every value is parameterized.
  const columns = Object.keys(data)
  const result = await client.query(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${columns.map((_, i) => `$${i+1}`).join(',')}) RETURNING *`, Object.values(data))
  return result.rows[0]
}
async function transaction(callback) {
  const c = await pool.connect()
  await c.query('BEGIN')
  try { await callback(c) } finally { await c.query('ROLLBACK'); c.release() }
}
async function rejectsConstraint(c, action, code = '23514') {
  await c.query('SAVEPOINT invalid_case')
  await assert.rejects(action, error => error.code === code)
  await c.query('ROLLBACK TO SAVEPOINT invalid_case')
}
const address = { recipientName: 'Fixture', phone: '0000000000', countryCode: 'MX', postalCode: '01000', state: 'Fixture', city: 'Fixture', district: 'Fixture', street: 'Fixture', exteriorNumber: '1' }
async function fixture(c) {
  const suffix = randomUUID()
  const user = await insert(c, 'User', { email: `${suffix}@example.invalid`, emailNormalized: `${suffix}@example.invalid`, passwordHash: 'fixture-hash-not-a-real-credential', displayName: 'Fixture' })
  const product = await insert(c, 'Product', { name: 'Producto sintético de prueba', slug: suffix, description: 'No es catálogo comercial', publishedAt: stamp() })
  const variant = await insert(c, 'ProductVariant', { productId: product.id, sku: suffix, flavor: 'Neutro', flavorNormalized: 'neutro', presentationLabel: 'Fixture', presentationNormalized: 'fixture', contentAmount: '100', contentUnit: 'g', priceCents: '1000', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 })
  const existing = await c.query('SELECT * FROM "Warehouse" LIMIT 1')
  const warehouse = existing.rows[0] ?? await insert(c, 'Warehouse', { name: 'Almacén sintético', ...address, contactName: 'Fixture' })
  const lot = await insert(c, 'InventoryLot', { variantId: variant.id, warehouseId: warehouse.id, lotCode: suffix })
  return { user, product, variant, warehouse, lot }
}
async function orderFixture(c, f, { points = 0, price = 1000 } = {}) {
  const o = await insert(c, 'Order', { orderNumber: randomUUID(), userId: f.user.id, buyerEmail: f.user.email, buyerEmailNormalized: f.user.emailNormalized, buyerName: 'Fixture', goodsBeforeCouponCents: String(price), couponDiscountCents: '0', goodsAfterCouponCents: String(price), pointsAppliedTenths: String(points), goodsMoneyCents: String(price-points), shippingQuotedCents: '0', shippingChargedCents: '0', shippingSubsidyCents: '0', totalMoneyCents: String(price-points), policySnapshot: {} })
  const line = await insert(c, 'OrderLine', { orderId: o.id, position: 0, variantId: f.variant.id, kind: 'VARIANT', quantity: 1, nameSnapshot: 'Fixture', skuOrCodeSnapshot: f.variant.sku, unitPriceCents: String(price), lineBeforeCouponCents: String(price), couponDiscountCents: '0', lineAfterCouponCents: String(price) })
  const component = await insert(c, 'OrderComponent', { orderId: o.id, orderLineId: line.id, variantId: f.variant.id, quantityPerLineUnit: 1, totalQuantity: 1, productSnapshot: {}, variantSnapshot: {}, referenceUnitPriceCents: String(price), allocatedBaseCents: String(price), allocatedCouponCents: '0', allocatedNetCents: String(price) })
  const unit = await insert(c, 'OrderUnit', { orderId: o.id, orderComponentId: component.id, variantId: f.variant.id, unitOrdinal: 1, baseCents: String(price), couponCents: '0', netGoodsCents: String(price), pointsTenths: String(points), moneyCents: String(price-points) })
  const quote = await insert(c, 'ShippingQuote', { cartId: null, orderId: o.id, requestFingerprint: randomUUID(), carrierCode: 'FIXTURE', serviceCode: 'FIXTURE', serviceName: 'Cotización sintética', quotedAmountCents: '0', originSnapshot: {}, destinationSnapshot: {}, packageSnapshot: {}, sanitizedResponse: {} })
  const reservation = await insert(c, 'ReservationSet', { orderId: o.id, attemptNumber: 1, expiresAt: new Date(Date.now()+29*60*1000), acceptedQuoteId: quote.id, checkoutFingerprint: randomUUID(), acceptedCheckoutSnapshot: {}, idempotencyKey: randomUUID() })
  return { o, line, component, unit, quote, reservation }
}
async function movement(c, f, data) {
  return insert(c, 'InventoryMovement', { lotId: f.lot.id, kind: 'RECEIPT', onHandDelta: 1, reservedDelta: 0, nonSellableDelta: 0, reason: 'Fixture explícita', actorType: 'SYSTEM', idempotencyKey: randomUUID(), ...data })
}

// Ledgers have no updatedAt. Strip it centrally before executing an INSERT.
const ledgers = new Set(['InventoryMovement', 'LoyaltyLedgerEntry', 'OrderStatusHistory', 'AuditEvent', 'ReviewModeration'])

test('57 tablas del diccionario y lectura/escritura con Prisma', async () => {
  const result = await pool.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`)
  assert.equal(result.rows[0].n, 57)
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
  try {
    const slug = `integration-${randomUUID()}`
    const brand = await db.brand.create({ data: { name: 'Marca sintética de integración', slug } })
    assert.equal((await db.brand.findUnique({ where: { id: brand.id } })).slug, slug)
    await db.brand.delete({ where: { id: brand.id } })
  } finally { await db.$disconnect() }
})

test('identidad/SKU siguen únicos después de soft delete', () => transaction(async c => {
  const f = await fixture(c)
  await c.query('UPDATE "User" SET "deletedAt" = now() WHERE id = $1', [f.user.id])
  await rejectsConstraint(c, () => insert(c, 'User', { email: f.user.email, emailNormalized: f.user.emailNormalized, passwordHash: 'fixture', displayName: 'Duplicate' }), '23505')
  await c.query('UPDATE "ProductVariant" SET "deletedAt" = now() WHERE id = $1', [f.variant.id])
  await rejectsConstraint(c, () => insert(c, 'ProductVariant', { ...Object.fromEntries(Object.entries(f.variant).filter(([k]) => !['id','createdAt','updatedAt'].includes(k))), flavor: 'Otra', flavorNormalized: 'otra' }), '23505')
}))

test('precios negativos, dos dueños y artículos ambiguos son rechazados', () => transaction(async c => {
  const f = await fixture(c)
  await rejectsConstraint(c, () => c.query('UPDATE "ProductVariant" SET "priceCents" = -1 WHERE id = $1', [f.variant.id]))
  await rejectsConstraint(c, () => insert(c, 'Cart', { userId: f.user.id, guestTokenHash: 'fixture' }))
  const cart = await insert(c, 'Cart', { userId: f.user.id })
  await rejectsConstraint(c, () => insert(c, 'CartItem', { cartId: cart.id, quantity: 1 }))
  await insert(c, 'CartItem', { cartId: cart.id, variantId: f.variant.id, quantity: 1 })
  await rejectsConstraint(c, () => insert(c, 'CartItem', { cartId: cart.id, variantId: f.variant.id, quantity: 2 }), '23505')
  assert.equal((await c.query('SELECT "reservedQty" FROM "InventoryLot" WHERE id = $1', [f.lot.id])).rows[0].reservedQty, 0)
}))

test('una dirección predeterminada y jerarquía sin ciclos', () => transaction(async c => {
  const f = await fixture(c)
  await insert(c, 'Address', { ...address, userId: f.user.id, isDefault: true })
  await rejectsConstraint(c, () => insert(c, 'Address', { ...address, userId: f.user.id, isDefault: true }), '23505')
  const root = await insert(c, 'Category', { name: 'Root', slug: randomUUID() })
  const child = await insert(c, 'Category', { name: 'Child', slug: randomUUID(), parentId: root.id })
  await rejectsConstraint(c, () => c.query('UPDATE "Category" SET "parentId" = $1 WHERE id = $2', [child.id, root.id]))
}))

test('inventario proyectado desde ledger e historial inmutable', () => transaction(async c => {
  const f = await fixture(c)
  const m = await movement(c, f, { onHandDelta: 2 })
  assert.equal((await c.query('SELECT "onHandQty" FROM "InventoryLot" WHERE id = $1', [f.lot.id])).rows[0].onHandQty, 2)
  await rejectsConstraint(c, () => c.query('UPDATE "InventoryLot" SET "onHandQty" = 99 WHERE id = $1', [f.lot.id]))
  await rejectsConstraint(c, () => c.query('DELETE FROM "InventoryMovement" WHERE id = $1', [m.id]))
  await rejectsConstraint(c, () => movement(c, f, { kind: 'ADJUSTMENT', onHandDelta: 1, actorType: 'ADMIN', actorId: f.user.id }))
}))

test('FK compuestas impiden mezclar pedidos en pagos y devoluciones', () => transaction(async c => {
  const f = await fixture(c)
  const a = await orderFixture(c, f)
  const b = await orderFixture(c, f)
  await rejectsConstraint(c, () => insert(c, 'PaymentAttempt', { orderId: a.o.id, reservationSetId: b.reservation.id, amountCents: '1000', idempotencyKey: randomUUID() }), '23503')
  const claim = await insert(c, 'ReturnRequest', { orderId: a.o.id, requestedByUserId: f.user.id, reasonCode: 'VOLUNTARY', description: 'Fixture', returnCostPayer: 'CUSTOMER' })
  await rejectsConstraint(c, () => insert(c, 'ReturnItem', { orderId: a.o.id, returnRequestId: claim.id, orderUnitId: b.unit.id }), '23503')
  await c.query('SET CONSTRAINTS ALL IMMEDIATE')
}))

test('cupones excluyentes, reservas únicas y plazos de sesión', () => transaction(async c => {
  const f = await fixture(c)
  await rejectsConstraint(c, () => insert(c, 'Coupon', { code: 'BAD', codeNormalized: 'bad', kind: 'PERCENTAGE', percentageBasisPoints: 10001 }))
  const a = await orderFixture(c, f)
  await rejectsConstraint(c, () => insert(c, 'ReservationSet', { orderId: a.o.id, attemptNumber: 2, expiresAt: new Date(Date.now()+29*60*1000), acceptedQuoteId: a.quote.id, checkoutFingerprint: 'fixture', acceptedCheckoutSnapshot: {}, idempotencyKey: randomUUID() }), '23505')
  await rejectsConstraint(c, () => insert(c, 'AuthSession', { userId: f.user.id, tokenFamilyId: randomUUID(), absoluteExpiresAt: new Date(Date.now()+8*86400000) }))
}))

test('puntos no pueden reservarse para el comprador de otro pedido', () => transaction(async c => {
  const f = await fixture(c)
  const other = await insert(c, 'User', { email: 'other@example.invalid', emailNormalized: 'other@example.invalid', passwordHash: 'fixture', displayName: 'Other' })
  const account = await insert(c, 'LoyaltyAccount', { userId: other.id })
  const a = await orderFixture(c, f)
  await rejectsConstraint(c, () => insert(c, 'PointReservation', { userId: other.id, orderId: a.o.id, reservationSetId: a.reservation.id, accountId: account.id, amountTenths: '1', expiresAt: a.reservation.expiresAt }), '23503')
}))

test('reseña sin compra entregada es rechazada', () => transaction(async c => {
  const f = await fixture(c)
  const a = await orderFixture(c, f)
  await rejectsConstraint(c, () => insert(c, 'Review', { userId: f.user.id, productId: f.product.id, verifiedOrderUnitId: a.unit.id, rating: 5, body: 'Fixture' }))
}))

test('reembolsos respetan sumas y capacidad remanente por unidad', () => transaction(async c => {
  const f = await fixture(c)
  const a = await orderFixture(c, f)
  const payment = await insert(c, 'PaymentAttempt', { orderId: a.o.id, reservationSetId: a.reservation.id, amountCents: '1000', status: 'SUCCEEDED', appliedToOrder: true, providerPaidAt: stamp(), idempotencyKey: randomUUID() })
  const refund = await insert(c, 'Refund', { orderId: a.o.id, paymentAttemptId: payment.id, kind: 'CANCELLATION', requestedMoneyCents: '700', requestedPointsTenths: '0', shippingRefundCents: '0', idempotencyKey: randomUUID() })
  await insert(c, 'RefundAllocation', { orderId: a.o.id, refundId: refund.id, orderUnitId: a.unit.id, kind: 'UNIT', moneyCents: '700', pointsTenths: '0', benefitReductionCents: '700' })
  await c.query('SET CONSTRAINTS ALL IMMEDIATE')
  await c.query('SET CONSTRAINTS ALL DEFERRED')
  await rejectsConstraint(c, async () => {
    const second = await insert(c, 'Refund', { orderId: a.o.id, paymentAttemptId: payment.id, kind: 'CANCELLATION', requestedMoneyCents: '400', requestedPointsTenths: '0', shippingRefundCents: '0', idempotencyKey: randomUUID() })
    await insert(c, 'RefundAllocation', { orderId: a.o.id, refundId: second.id, orderUnitId: a.unit.id, kind: 'UNIT', moneyCents: '400', pointsTenths: '0', benefitReductionCents: '400' })
    await c.query('SET CONSTRAINTS ALL IMMEDIATE')
  })
}))

test('compensación usa su cobro y no admite asignaciones comerciales', () => transaction(async c => {
  const f = await fixture(c)
  const a = await orderFixture(c, f)
  const payment = await insert(c, 'PaymentAttempt', { orderId: a.o.id, reservationSetId: a.reservation.id, amountCents: '1000', status: 'SUCCEEDED', providerPaidAt: stamp(), idempotencyKey: randomUUID() })
  const refund = await insert(c, 'Refund', { orderId: a.o.id, paymentAttemptId: payment.id, kind: 'COMPENSATION', requestedMoneyCents: '1000', requestedPointsTenths: '0', shippingRefundCents: '0', idempotencyKey: randomUUID() })
  await c.query('SET CONSTRAINTS ALL IMMEDIATE')
  await rejectsConstraint(c, async () => {
    await insert(c, 'RefundAllocation', { orderId: a.o.id, refundId: refund.id, orderUnitId: a.unit.id, kind: 'UNIT', moneyCents: '1', pointsTenths: '0', benefitReductionCents: '1' })
  })
}))

test('dos reservas concurrentes no consumen la última pieza dos veces', async () => {
  const setup = await pool.connect()
  let f, a, b
  try {
    await setup.query('BEGIN')
    f = await fixture(setup)
    await movement(setup, f, { onHandDelta: 1 })
    a = await orderFixture(setup, f)
    b = await orderFixture(setup, f)
    a.stock = await insert(setup, 'ReservationStock', { reservationSetId: a.reservation.id, lotId: f.lot.id, quantity: 1 })
    b.stock = await insert(setup, 'ReservationStock', { reservationSetId: b.reservation.id, lotId: f.lot.id, quantity: 1 })
    await setup.query('COMMIT')
  } catch (error) { await setup.query('ROLLBACK'); throw error } finally { setup.release() }
  const reserve = async stock => {
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      await movement(c, f, { kind: 'RESERVE', onHandDelta: 0, reservedDelta: 1, reservationStockId: stock.id })
      await c.query('COMMIT')
      return 'reserved'
    } catch (error) {
      await c.query('ROLLBACK')
      assert.equal(error.code, '23514')
      return 'rejected'
    } finally { c.release() }
  }
  assert.deepEqual((await Promise.all([reserve(a.stock), reserve(b.stock)])).sort(), ['rejected', 'reserved'])
  const lot = (await pool.query('SELECT "onHandQty", "reservedQty" FROM "InventoryLot" WHERE id = $1', [f.lot.id])).rows[0]
  assert.deepEqual(lot, { onHandQty: 1, reservedQty: 1 })
})

test('confirmación de total cero sin Stripe y snapshots protegidos', () => transaction(async c => {
  const f = await fixture(c)
  await c.query('UPDATE "ProductVariant" SET "priceCents" = 0 WHERE id = $1', [f.variant.id])
  const a = await orderFixture(c, f, { price: 0 })
  await movement(c, f, { onHandDelta: 1 })
  const stock = await insert(c, 'ReservationStock', { reservationSetId: a.reservation.id, lotId: f.lot.id, quantity: 1 })
  await movement(c, f, { kind: 'RESERVE', onHandDelta: 0, reservedDelta: 1, reservationStockId: stock.id })
  await c.query('UPDATE "OrderUnit" SET "lotId" = $1, "lotSnapshot" = $2 WHERE id = $3', [f.lot.id, {}, a.unit.id])
  await movement(c, f, { kind: 'SALE', onHandDelta: -1, reservedDelta: -1, reservationStockId: stock.id, orderUnitId: a.unit.id })
  await insert(c, 'OrderAddress', { orderId: a.o.id, ...address })
  await insert(c, 'OrderPackage', { orderId: a.o.id, quoteId: a.quote.id, warehouseId: f.warehouse.id, originSnapshot: {}, packageCodeSnapshot: 'FIXTURE', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100, packingPlanSnapshot: {}, carrierSnapshot: {}, serviceSnapshot: {}, deliveryEstimateSnapshot: {}, acceptedAt: stamp() })
  await c.query('UPDATE "ReservationSet" SET state = \'CONSUMED\', "resolvedAt" = now() WHERE id = $1', [a.reservation.id])
  await insert(c, 'OrderStatusHistory', { orderId: a.o.id, fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', actorType: 'SYSTEM', eventKey: randomUUID() })
  await c.query('UPDATE "Order" SET status = \'CONFIRMED\', "moneyStatus" = \'NOT_REQUIRED\', "confirmedAt" = now() WHERE id = $1', [a.o.id])
  await c.query('SET CONSTRAINTS ALL IMMEDIATE')
  assert.equal((await c.query('SELECT count(*)::int AS n FROM "PaymentAttempt" WHERE "orderId" = $1', [a.o.id])).rows[0].n, 0)
  await rejectsConstraint(c, () => c.query('UPDATE "OrderLine" SET "nameSnapshot" = \'Changed\' WHERE id = $1', [a.line.id]))
  await rejectsConstraint(c, () => c.query('UPDATE "Order" SET status = \'SHIPPED\', "shippedAt" = now() WHERE id = $1', [a.o.id]))
  await rejectsConstraint(c, () => c.query('UPDATE "ReservationSet" SET state = \'ACTIVE\', "resolvedAt" = NULL WHERE id = $1', [a.reservation.id]))
}))

test('repartos inconsistentes y confirmación incompleta se rechazan al cerrar transacción', () => transaction(async c => {
  const f = await fixture(c)
  const a = await orderFixture(c, f)
  await c.query('SET CONSTRAINTS ALL IMMEDIATE')
  await c.query('SET CONSTRAINTS ALL DEFERRED')
  await rejectsConstraint(c, async () => {
    await c.query('UPDATE "OrderComponent" SET "allocatedBaseCents" = 900, "allocatedNetCents" = 900 WHERE id = $1', [a.component.id])
    await c.query('SET CONSTRAINTS ALL IMMEDIATE')
  })
  await rejectsConstraint(c, async () => {
    await c.query('UPDATE "Order" SET status = \'CONFIRMED\', "confirmedAt" = now() WHERE id = $1', [a.o.id])
    await c.query('SET CONSTRAINTS ALL IMMEDIATE')
  })
}))

test('configuración exige administrador real y registra texto', () => transaction(async c => {
  const f = await fixture(c)
  const values = { storeName: 'Fixture', contactEmail: 'fixture@example.invalid', contactPhone: '0000000000', serviceHours: 'Fixture', updatedById: f.user.id }
  await rejectsConstraint(c, () => insert(c, 'StoreSettings', values))
  await c.query('UPDATE "User" SET role = \'ADMIN\' WHERE id = $1', [f.user.id])
  await insert(c, 'StoreSettings', values)
}))

test('ledger de puntos admite ajustes negativos sin inventar saldo gastable', () => transaction(async c => {
  const f = await fixture(c)
  await c.query('UPDATE "User" SET role = \'ADMIN\' WHERE id = $1', [f.user.id])
  const account = await insert(c, 'LoyaltyAccount', { userId: f.user.id })
  await insert(c, 'LoyaltyLedgerEntry', { accountId: account.id, kind: 'ADJUSTMENT', deltaTenths: '100', balanceAfterTenths: '100', actorId: f.user.id, reason: 'Fixture', idempotencyKey: randomUUID() })
  const a = await orderFixture(c, f)
  const reservation = await insert(c, 'PointReservation', { userId: f.user.id, orderId: a.o.id, reservationSetId: a.reservation.id, accountId: account.id, amountTenths: '50', expiresAt: a.reservation.expiresAt })
  assert.equal((await c.query('SELECT "reservedTenths" FROM "LoyaltyAccount" WHERE id = $1', [account.id])).rows[0].reservedTenths, '50')
  await c.query('UPDATE "PointReservation" SET state = \'RELEASED\', "releasedAt" = now() WHERE id = $1', [reservation.id])
  await insert(c, 'LoyaltyLedgerEntry', { accountId: account.id, kind: 'ADJUSTMENT', deltaTenths: '-150', balanceAfterTenths: '-50', actorId: f.user.id, reason: 'Fixture', idempotencyKey: randomUUID() })
  const balances = (await c.query('SELECT "balanceTenths", "reservedTenths" FROM "LoyaltyAccount" WHERE id = $1', [account.id])).rows[0]
  assert.deepEqual(balances, { balanceTenths: '-50', reservedTenths: '0' })
  await rejectsConstraint(c, () => c.query('UPDATE "LoyaltyAccount" SET "balanceTenths" = 999 WHERE id = $1', [account.id]))
}))
