import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { withInventoryTransaction } from '../../server/features/inventory/inventory-transaction.js'
import { reservePoints, consumePoints, releasePoints, creditDeliveredOrder, readLoyalty } from '../../server/features/loyalty/loyalty-repository.js'
import { deliveredFixture } from './order-fixture.mjs'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
async function user() { const email = `${randomUUID()}@example.invalid`; return db.user.create({ data: { email, emailNormalized: email, passwordHash: 'fixture', displayName: 'Fixture', role: 'ADMIN' } }) }
async function pending(user, points) {
  return db.$transaction(async tx => {
    const o = await tx.order.create({ data: { orderNumber: randomUUID(), userId: user.id, buyerEmail: user.email, buyerEmailNormalized: user.emailNormalized, buyerName: 'Fixture', goodsBeforeCouponCents: points, couponDiscountCents: 0n, goodsAfterCouponCents: points, pointsAppliedTenths: points, goodsMoneyCents: 0n, shippingQuotedCents: 0n, shippingChargedCents: 0n, shippingSubsidyCents: 0n, totalMoneyCents: 0n, policySnapshot: {} } })
    const q = await tx.shippingQuote.create({ data: { orderId: o.id, requestFingerprint: randomUUID(), carrierCode: 'FIXTURE', serviceCode: 'FIXTURE', serviceName: 'Prueba', quotedAmountCents: 0n, originSnapshot: {}, destinationSnapshot: {}, packageSnapshot: {}, sanitizedResponse: {} } })
    return tx.reservationSet.create({ data: { orderId: o.id, attemptNumber: 1, expiresAt: new Date(Date.now()+29*60000), acceptedQuoteId: q.id, checkoutFingerprint: randomUUID(), acceptedCheckoutSnapshot: {}, idempotencyKey: randomUUID() } })
  })
}
test('dos canjes concurrentes no duplican saldo; liberar/consumir idempotentes por ledger', async () => {
  const u = await user(), a = await db.loyaltyAccount.create({ data: { userId: u.id } })
  await db.loyaltyLedgerEntry.create({ data: { accountId: a.id, kind: 'ADJUSTMENT', deltaTenths: 100n, balanceAfterTenths: 100n, actorId: u.id, reason: 'Fixture', idempotencyKey: randomUUID() } })
  const reservations = await Promise.all([80n,80n].map(n => pending(u,n)))
  const results = await Promise.allSettled(reservations.map(r => withInventoryTransaction(db, c => reservePoints(c,r.id))))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const active = reservations[results.findIndex(r => r.status === 'fulfilled')]
  assert.equal((await readLoyalty(db,u.id)).availableTenths,'20')
  await withInventoryTransaction(db,c => releasePoints(c,active.id)); await withInventoryTransaction(db,c => releasePoints(c,active.id))
  assert.equal((await readLoyalty(db,u.id)).availableTenths,'100')
  const all = await pending(u,100n)
  await withInventoryTransaction(db,c => reservePoints(c,all.id))
  await withInventoryTransaction(db,c => consumePoints(c,all.id)); await withInventoryTransaction(db,c => consumePoints(c,all.id))
  assert.equal((await readLoyalty(db,u.id)).balanceTenths,'0')
  assert.equal(await db.loyaltyLedgerEntry.count({ where: { accountId: a.id, kind:'REDEEM' } }),1)
})
test('entrega repetida acredita una vez y saldo negativo no crea saldo disponible', async () => {
  const u = await user(), f = await deliveredFixture(db,u.id)
  const results = await Promise.all([1,2].map(() => db.$transaction(tx => creditDeliveredOrder(tx,f.order.id))))
  assert.equal(results.filter(r => !r.repeated).length,1)
  const a = await db.loyaltyAccount.findUnique({ where:{userId:u.id} })
  await db.loyaltyLedgerEntry.create({ data:{accountId:a.id,kind:'ADJUSTMENT',deltaTenths:-10n,balanceAfterTenths:-10n,actorId:u.id,reason:'Fixture',idempotencyKey:randomUUID()} })
  assert.equal((await readLoyalty(db,u.id)).availableTenths,'0')
  assert.equal((await readLoyalty(db,u.id)).balanceTenths,'-10')
})
