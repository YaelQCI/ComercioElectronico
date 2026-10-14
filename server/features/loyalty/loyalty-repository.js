import { AccountError } from '../accounts/credentials.js'
import { inventoryTransaction } from '../inventory/inventory-transaction.js'
import { earnedTenths, availableTenths } from '../../../shared/features/loyalty/points.js'

async function account(tx, userId) {
  const saved = await tx.loyaltyAccount.upsert({ where: { userId }, create: { userId }, update: {} })
  await tx.$queryRaw`SELECT id FROM "LoyaltyAccount" WHERE id = ${saved.id}::uuid FOR UPDATE`
  return tx.loyaltyAccount.findUnique({ where: { id: saved.id } })
}
export async function creditDeliveredOrder(tx, orderId) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { user: true } })
  if (!order || order.status !== 'DELIVERED') throw new AccountError(409, 'Solo se acreditan pedidos entregados.')
  if (!order.userId || order.user.deletedAt) return { deferred: true }
  const a = await account(tx, order.userId), prior = await tx.loyaltyLedgerEntry.findUnique({ where: { idempotencyKey: `earn:${orderId}` } })
  if (prior) return { deferred: false, earnedTenths: prior.deltaTenths.toString(), repeated: true }
  const refund = await tx.refundAllocation.aggregate({ where: { orderId, kind: 'UNIT', refund: { status: 'SETTLED' } }, _sum: { moneyCents: true } })
  const delta = BigInt(earnedTenths(order.goodsMoneyCents.toString(), (refund._sum.moneyCents ?? 0n).toString()))
  await tx.loyaltyLedgerEntry.create({ data: { accountId: a.id, orderId, kind: 'EARN', deltaTenths: delta, balanceAfterTenths: a.balanceTenths + delta, idempotencyKey: `earn:${orderId}`, reason: 'Ganancia al entregar pedido vinculado' } })
  return { deferred: false, earnedTenths: delta.toString(), repeated: false }
}
async function reservation(context, id) {
  const tx = inventoryTransaction(context), found = await tx.reservationSet.findUnique({ where: { id } })
  if (!found) throw new AccountError(404, 'Reserva no disponible.')
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${found.orderId}::uuid FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "ReservationSet" WHERE id = ${id}::uuid FOR UPDATE`
  const r = await tx.reservationSet.findUnique({ where: { id }, include: { order: { include: { user: true } }, paymentAttempt_reservationSet: true } })
  return { tx, r }
}
export async function reservePoints(context, id) {
  const { tx, r } = await reservation(context, id), o = r.order
  if (!o.pointsAppliedTenths) return null
  if (!o.userId || o.user.deletedAt || o.pointsAppliedTenths > o.goodsAfterCouponCents || r.state !== 'ACTIVE' || r.expiresAt <= new Date() || o.status !== 'PENDING_PAYMENT') throw new AccountError(409, 'Canje no disponible.')
  const a = await account(tx, o.userId), prior = await tx.pointReservation.findUnique({ where: { reservationSetId: id } })
  if (prior) { if (prior.state !== 'RESERVED' || prior.amountTenths !== o.pointsAppliedTenths || prior.accountId !== a.id) throw new AccountError(409, 'Reserva de puntos incompatible.'); return prior }
  if (o.pointsAppliedTenths > BigInt(availableTenths(a.balanceTenths.toString(), a.reservedTenths.toString()))) throw new AccountError(409, 'Saldo disponible insuficiente.')
  return tx.pointReservation.create({ data: { reservationSetId: id, orderId: o.id, userId: o.userId, accountId: a.id, amountTenths: o.pointsAppliedTenths, expiresAt: r.expiresAt } })
}
export async function consumePoints(context, id) {
  const { tx, r } = await reservation(context, id), o = r.order
  if (!o.pointsAppliedTenths) return null
  const p = await tx.pointReservation.findUnique({ where: { reservationSetId: id } })
  if (!p || p.amountTenths !== o.pointsAppliedTenths) throw new AccountError(409, 'Canje no reservado.')
  if (p.state === 'CONSUMED') return p
  const paid = r.paymentAttempt_reservationSet.some(p => p.status === 'SUCCEEDED' && p.amountCents === o.totalMoneyCents && p.currency === 'MXN' && p.providerPaidAt && p.providerPaidAt <= r.expiresAt)
  if (p.state !== 'RESERVED' || !['ACTIVE','RECONCILING','CONSUMED'].includes(r.state) || (o.totalMoneyCents === 0n ? r.expiresAt <= new Date() || r.paymentAttempt_reservationSet.length > 0 : !paid)) throw new AccountError(409, 'Confirma el pago antes de consumir puntos.')
  const a = await account(tx, o.userId)
  if (a.balanceTenths < a.reservedTenths) throw new AccountError(409, 'Saldo requiere reconciliación antes de confirmar.')
  const saved = await tx.pointReservation.update({ where: { id: p.id }, data: { state: 'CONSUMED', consumedAt: new Date() } })
  await tx.loyaltyLedgerEntry.create({ data: { accountId: a.id, orderId: o.id, kind: 'REDEEM', deltaTenths: -p.amountTenths, balanceAfterTenths: a.balanceTenths-p.amountTenths, idempotencyKey: `redeem:${p.id}`, reason: 'Canje confirmado' } })
  return saved
}
export async function releasePoints(context, id) {
  const { tx, r } = await reservation(context, id), p = await tx.pointReservation.findUnique({ where: { reservationSetId: id } })
  if (!p || p.state === 'RELEASED') return p
  if (p.state !== 'RESERVED' || r.state === 'CONSUMED' || r.paymentAttempt_reservationSet.some(p => !['FAILED','EXPIRED'].includes(p.status) || !p.lastReconciledAt)) throw new AccountError(409, 'Reconciliar pago antes de liberar puntos.')
  return tx.pointReservation.update({ where: { id: p.id }, data: { state: 'RELEASED', releasedAt: new Date() } })
}
export async function readLoyalty(db, userId, page = 1) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new AccountError(400, 'Página inválida.')
  return db.$transaction(async tx => {
    const a = await tx.loyaltyAccount.findUnique({ where: { userId } })
    if (!a) return { balanceTenths: '0', reservedTenths: '0', availableTenths: '0', movements: [], page, pages: 0 }
    const total = await tx.loyaltyLedgerEntry.count({ where: { accountId: a.id } }), rows = await tx.loyaltyLedgerEntry.findMany({ where: { accountId: a.id }, skip: (page-1)*20, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })
    return { balanceTenths: a.balanceTenths.toString(), reservedTenths: a.reservedTenths.toString(), availableTenths: availableTenths(a.balanceTenths.toString(), a.reservedTenths.toString()), page, pages: Math.ceil(total/20), movements: rows.map(r => ({ kind: r.kind, deltaTenths: r.deltaTenths.toString(), balanceAfterTenths: r.balanceAfterTenths.toString(), date: r.createdAt.toISOString(), reason: r.reason })) }
  }, { isolationLevel: 'RepeatableRead' })
}
