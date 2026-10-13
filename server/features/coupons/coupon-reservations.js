import { inventoryTransaction } from '../inventory/inventory-transaction.js'
import { evaluateCoupon, CouponError } from '../../../shared/features/coupons/coupon-eligibility.js'
import { couponDefinition, cartCouponInclude } from './cart-coupon.js'

async function lock(context, id) {
  const tx = inventoryTransaction(context)
  const found = await tx.reservationSet.findUnique({ where: { id } })
  if (!found) throw new CouponError('Reserva inexistente.')
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${found.orderId}::uuid FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "ReservationSet" WHERE id = ${id}::uuid FOR UPDATE`
  const reservation = await tx.reservationSet.findUnique({ where: { id }, include: { order: true, paymentAttempt_reservationSet: true } })
  if (reservation.order.couponId) await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${reservation.order.couponId}::uuid FOR UPDATE`
  const [clock] = await tx.$queryRaw`SELECT clock_timestamp() AS now`
  return { tx, reservation, order: reservation.order, now: clock.now }
}
export async function reserveCoupon(context, id) {
  const { tx, reservation, order, now } = await lock(context, id)
  if (!order.couponId) return null
  if (reservation.state !== 'ACTIVE' || reservation.expiresAt <= now || order.status !== 'PENDING_PAYMENT') throw new CouponError('Reserva vencida o no activa.')
  const existing = await tx.couponUsage.findUnique({ where: { reservationSetId: id } })
  if (existing) {
    if (existing.state !== 'RESERVED' || existing.couponId !== order.couponId || existing.orderId !== order.id || existing.emailNormalizedSnapshot !== order.buyerEmailNormalized || existing.expiresAt.getTime() !== reservation.expiresAt.getTime()) throw new CouponError('Uso de cupón incompatible con la reserva.')
    return existing
  }
  const coupon = await tx.coupon.findUnique({ where: { id: order.couponId }, include: cartCouponInclude.selectedCoupon.include })
  if (order.couponSnapshot?.version !== coupon.version) throw new CouponError('El cupón cambió. Requiere nueva aceptación del checkout.')
  const email = order.buyerEmail.trim().toLowerCase()
  if (email !== order.buyerEmailNormalized || !/^\S+@\S+\.\S+$/.test(email)) throw new CouponError('Identidad del comprador inválida.')
  const identityKey = order.userId ? `user:${order.userId}` : `email:${email}`
  const states = { in: ['RESERVED', 'CONSUMED'] }
  const customerUses = await tx.couponUsage.count({ where: { couponId: coupon.id, state: states, OR: [{ identityKey }, { emailNormalizedSnapshot: email }] } })
  const savedLines = await tx.orderLine.findMany({ where: { orderId: order.id }, include: { orderComponent_orderLine: true } })
  const lines = savedLines.map(line => ({ id: line.id, baseCents: line.lineBeforeCouponCents.toString(), isBundle: line.kind === 'BUNDLE', components: line.orderComponent_orderLine.map(c => {
    if (typeof c.productSnapshot.id !== 'string' || !Array.isArray(c.productSnapshot.categoryIds)) throw new CouponError('Snapshot de producto incompleto para cupón.')
    return { id: c.id, productId: c.productSnapshot.id, categoryIds: c.productSnapshot.categoryIds, referencePriceCents: c.referenceUnitPriceCents.toString(), compareAtPriceCents: c.variantSnapshot.compareAtPriceCents ?? null, allocatedBaseCents: c.allocatedBaseCents.toString() }
  }) }))
  const result = evaluateCoupon(couponDefinition(coupon), lines, { now, globalUses: coupon._count.couponUsage_coupon, customerUses })
  if (BigInt(result.discountCents) !== order.couponDiscountCents) throw new CouponError('Descuento del pedido no coincide con cupón vigente.')
  for (const line of savedLines) {
    const expected = result.lines.find(l => l.id === line.id)
    if (BigInt(expected.discountCents) !== line.couponDiscountCents || line.orderComponent_orderLine.reduce((sum,c) => sum + c.allocatedBaseCents, 0n) !== line.lineBeforeCouponCents) throw new CouponError('Asignación de cupón inconsistente.')
    for (const component of line.orderComponent_orderLine) if (BigInt(expected.components.find(c => c.id === component.id).cents) !== component.allocatedCouponCents) throw new CouponError('Asignación por componente inconsistente.')
  }
  return tx.couponUsage.create({ data: { couponId: coupon.id, reservationSetId: id, orderId: order.id, identityKey, userId: order.userId, emailNormalizedSnapshot: email, expiresAt: reservation.expiresAt } })
}
export async function consumeCoupon(context, id) {
  const { tx, reservation, order, now } = await lock(context, id)
  const usage = await tx.couponUsage.findUnique({ where: { reservationSetId: id } })
  if (!order.couponId) return null
  if (!usage) throw new CouponError('No hay uso de cupón reservado.')
  if (usage.couponId !== order.couponId || usage.orderId !== order.id) throw new CouponError('Uso de cupón incompatible con el pedido.')
  if (usage.state === 'CONSUMED') return usage
  if (usage.state !== 'RESERVED' || !['ACTIVE', 'RECONCILING', 'CONSUMED'].includes(reservation.state)) throw new CouponError('El uso de cupón no puede consumirse.')
  const payments = reservation.paymentAttempt_reservationSet
  const paid = payments.some(p => p.status === 'SUCCEEDED' && p.currency === 'MXN' && p.amountCents === order.totalMoneyCents && p.providerPaidAt && p.providerPaidAt <= reservation.expiresAt)
  if (order.totalMoneyCents === 0n ? payments.length > 0 || reservation.expiresAt <= now : !paid) throw new CouponError('Se requiere pago reconciliado en plazo o confirmación válida de total cero.')
  return tx.couponUsage.update({ where: { id: usage.id }, data: { state: 'CONSUMED', consumedAt: now } })
}
export async function releaseCoupon(context, id) {
  const { tx, reservation, order, now } = await lock(context, id)
  if (!order.couponId) return null
  const usage = await tx.couponUsage.findUnique({ where: { reservationSetId: id } })
  if (!usage || usage.state === 'RELEASED') return usage
  if (usage.couponId !== order.couponId || usage.orderId !== order.id) throw new CouponError('Uso de cupón incompatible con el pedido.')
  if (usage.state !== 'RESERVED' || reservation.state === 'CONSUMED') throw new CouponError('El uso de cupón no puede liberarse.')
  if (reservation.paymentAttempt_reservationSet.some(p => !['FAILED', 'EXPIRED'].includes(p.status) || !p.lastReconciledAt)) throw new CouponError('Reconciliar pagos antes de liberar uso de cupón.')
  return tx.couponUsage.update({ where: { id: usage.id }, data: { state: 'RELEASED', releasedAt: now } })
}
