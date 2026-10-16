import test from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { initializeDemoHistory } from '../../server/features/orders/initialize-demo-history.js'
import { createReviews } from '../../server/features/reviews/review-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
const orderWhere = { orderNumber: { startsWith: 'DEMO-PEDIDO-' } }

test('historial DEMO: seis clientes, doce pedidos coherentes y ocho reseñas de cuatro compras entregadas', async () => {
  const users = await db.user.findMany({ where: { emailNormalized: { endsWith: '@demo.example.invalid' } } })
  assert.equal(users.length, 6)
  for (const user of users) {
    assert.equal(user.role, 'CUSTOMER'); assert.ok(user.displayName.includes('DEMO'))
    assert.equal(user.passwordHash, 'DEMO_ACCOUNT_WITHOUT_LOGIN'); assert.equal(user.emailVerifiedAt, null)
    assert.equal(await db.authSession.count({ where: { userId: user.id } }), 0)
  }
  const orders = await db.order.findMany({ where: orderWhere, include: { orderLine_order: true, orderUnit_order: { include: { variant: true } }, orderStatusHistory_order: { orderBy: { createdAt: 'asc' } }, reservationSet_order: true, paymentAttempt_order: true, orderPackage_order: true } })
  assert.equal(orders.length, 12)
  const distribution = {}
  for (const order of orders) {
    distribution[order.status] = (distribution[order.status] ?? 0) + 1
    assert.ok(users.some(user => user.id === order.userId))
    assert.equal(order.policySnapshot.demo, true)
    assert.equal(order.orderLine_order.length, 2); assert.equal(order.orderUnit_order.length, 2)
    assert.equal(order.orderLine_order.reduce((sum, line) => sum + line.lineBeforeCouponCents, 0n), order.goodsBeforeCouponCents)
    assert.equal(order.orderLine_order.reduce((sum, line) => sum + line.lineAfterCouponCents, 0n), order.goodsAfterCouponCents)
    assert.equal(order.paymentAttempt_order.length, 0)
    assert.ok(order.orderUnit_order.every(unit => unit.variant.sku.startsWith('DEMO-')))
    const history = order.orderStatusHistory_order
    assert.equal(history[0].toStatus, 'PENDING_PAYMENT'); assert.equal(history.at(-1).toStatus, order.status)
    assert.ok(history.every(item => item.actorType === 'SYSTEM' && item.reason.includes('DEMO')))
    if (order.status === 'PENDING_PAYMENT') {
      assert.ok(order.totalMoneyCents > 0n); assert.equal(order.moneyStatus, 'PENDING')
      assert.equal(order.reservationSet_order.length, 0)
      assert.ok(order.orderUnit_order.every(unit => unit.lotId === null))
    } else {
      assert.equal(order.totalMoneyCents, 0n); assert.equal(order.moneyStatus, 'NOT_REQUIRED')
      assert.equal(order.goodsBeforeCouponCents, order.couponDiscountCents)
      assert.equal(order.reservationSet_order[0].state, 'CONSUMED')
      assert.equal(order.orderPackage_order.carrierSnapshot.demo, true)
      for (const unit of order.orderUnit_order) {
        const lot = await db.inventoryLot.findUniqueOrThrow({ where: { id: unit.lotId } })
        assert.equal(lot.onHandQty, 0); assert.equal(lot.reservedQty, 0)
        assert.ok(lot.lotCode.includes('HISTORICO'))
        const movements = await db.inventoryMovement.findMany({ where: { lotId: lot.id }, orderBy: { createdAt: 'asc' } })
        assert.deepEqual(movements.map(movement => movement.kind), ['RECEIPT', 'RESERVE', 'SALE'])
        assert.equal(movements.reduce((sum, movement) => sum + movement.onHandDelta, 0), 0)
      }
    }
  }
  assert.deepEqual(distribution, { DELIVERED: 6, CONFIRMED: 1, PREPARING: 2, SHIPPED: 1, PENDING_PAYMENT: 2 })
  const reviews = await db.review.findMany({ where: { userId: { in: users.map(user => user.id) } }, include: { verifiedOrderUnit: { include: { order: true, variant: true } } } })
  assert.equal(reviews.length, 8)
  assert.equal(new Set(reviews.map(review => review.verifiedOrderUnit.orderId)).size, 4)
  for (const review of reviews) {
    assert.equal(review.verifiedOrderUnit.order.status, 'DELIVERED')
    assert.equal(review.verifiedOrderUnit.order.userId, review.userId)
    assert.equal(review.verifiedOrderUnit.variant.productId, review.productId)
    assert.ok(review.body.includes('DEMOSTRACIÓN'))
    const visible = await createReviews(db).list(review.productId)
    assert.ok(visible.reviews.some(item => item.id === review.id && item.verified))
  }
})

test('historial DEMO repetido preserva cuentas, estados, moderación y stock inicial', async () => {
  assert.equal(await initializeDemoHistory(db), 0)
  const before = { orders: await db.order.count(), reviews: await db.review.count(), movements: await db.inventoryMovement.count() }
  const rollback = Error('Revertir únicamente la edición sintética de la prueba')
  await assert.rejects(db.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { emailNormalized: 'cliente01@demo.example.invalid' } })
    const review = await tx.review.findFirstOrThrow({ where: { userId: user.id } })
    await tx.user.update({ where: { id: user.id }, data: { displayName: 'Cliente DEMO editado' } })
    await tx.review.update({ where: { id: review.id }, data: { body: 'Reseña DEMO editada', hiddenAt: new Date() } })
    assert.equal(await initializeDemoHistory(tx), 0)
    assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).displayName, 'Cliente DEMO editado')
    assert.ok((await tx.review.findUniqueOrThrow({ where: { id: review.id } })).hiddenAt)
    assert.equal(await tx.order.count(), before.orders); assert.equal(await tx.review.count(), before.reviews); assert.equal(await tx.inventoryMovement.count(), before.movements)
    throw rollback
  }), error => error === rollback)
})
