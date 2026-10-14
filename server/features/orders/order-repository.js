import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
const validId = value => { if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value ?? '')) throw new AccountError(400, 'Pedido inválido.'); return value }
const include = { orderLine_order: { orderBy: { position: 'asc' } }, orderStatusHistory_order: { orderBy: { createdAt: 'asc' } } }
export function publicOrder(order) {
  return { id: order.id, number: order.orderNumber, status: order.status, moneyStatus: order.moneyStatus, currency: order.currency, createdAt: order.createdAt.toISOString(), totalMoneyCents: order.totalMoneyCents.toString(), shippingChargedCents: order.shippingChargedCents.toString(), couponDiscountCents: order.couponDiscountCents.toString(), pointsAppliedTenths: order.pointsAppliedTenths.toString(), lines: order.orderLine_order.map(l => ({ name: l.nameSnapshot, sku: l.skuOrCodeSnapshot, quantity: l.quantity, unitPriceCents: l.unitPriceCents.toString(), lineAfterCouponCents: l.lineAfterCouponCents.toString() })), history: order.orderStatusHistory_order.map(h => ({ status: h.toStatus, date: h.createdAt.toISOString() })) }
}
const nextStates = { CONFIRMED: 'PREPARING', PREPARING: 'SHIPPED', SHIPPED: 'DELIVERED' }
export function createOrders(db) {
  return {
    async list(userId, page = 1, administrative = false) {
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new AccountError(400, 'Página inválida.')
      return db.$transaction(async tx => {
        if (administrative) await requireAdministrator(tx, userId)
        const where = administrative ? {} : { userId }
        const total = await tx.order.count({ where }), rows = await tx.order.findMany({ where, skip: (page-1)*10, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include })
        return { page, pages: Math.ceil(total/10), total, orders: rows.map(publicOrder) }
      }, { isolationLevel: 'RepeatableRead' })
    },
    async read(userId, orderId, administrative = false) {
      validId(orderId)
      return db.$transaction(async tx => {
        if (administrative) await requireAdministrator(tx, userId)
        const order = await tx.order.findFirst({ where: { id: orderId, ...(administrative ? {} : { userId }) }, include: { ...include, orderAddress_order: true } })
        if (!order) throw new AccountError(404, 'Pedido no disponible.')
        const a = order.orderAddress_order
        return { ...publicOrder(order), address: a ? { recipientName: a.recipientName, street: a.street, exteriorNumber: a.exteriorNumber, interiorNumber: a.interiorNumber, district: a.district, city: a.city, state: a.state, postalCode: a.postalCode } : null }
      })
    },
    async advance(adminId, orderId, input) {
      validId(orderId); const reason = accountText(input?.reason, 'Motivo', 500), eventKey = accountText(input?.idempotencyKey, 'Clave', 150)
      if (!['PREPARING', 'SHIPPED', 'DELIVERED'].includes(input?.status) || !nextStates[input?.expectedStatus]) throw new AccountError(400, 'Transición operativa inválida.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`
        const prior = await tx.orderStatusHistory.findUnique({ where: { eventKey } })
        if (prior) {
          if (prior.orderId !== orderId || prior.toStatus !== input.status || prior.fromStatus !== input.expectedStatus || prior.actorId !== adminId || prior.reason !== reason) throw new AccountError(409, 'Clave utilizada para otra transición.')
          return { ok: true, status: prior.toStatus, repeated: true }
        }
        const order = await tx.order.findUnique({ where: { id: orderId } })
        if (!order) throw new AccountError(404, 'Pedido no disponible.')
        if (order.status !== input.expectedStatus || nextStates[order.status] !== input.status || !['PAID', 'NOT_REQUIRED', 'PARTIALLY_REFUNDED'].includes(order.moneyStatus)) throw new AccountError(409, 'El pedido cambió o no admite esta transición.')
        await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: input.status, actorId: adminId, actorType: 'ADMIN', reason, eventKey } })
        await tx.order.update({ where: { id: orderId }, data: { status: input.status, ...(input.status === 'SHIPPED' ? { shippedAt: new Date() } : input.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) } })
        return { ok: true, status: input.status, repeated: false }
      })
    },
  }
}
