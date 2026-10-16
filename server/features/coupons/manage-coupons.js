import { randomUUID } from 'node:crypto'
import { requireAdministrator } from '../../utils/authorization.js'
import { AccountError } from '../accounts/credentials.js'
import { couponInput } from './coupon-input.js'

const include = { couponProduct_coupon: { include: { product: { select: { id: true, name: true } } } }, couponCategory_coupon: { include: { category: { select: { id: true, name: true } } } } }
function dto(row) {
  const { couponProduct_coupon, couponCategory_coupon, ...fields } = row
  return { ...fields, fixedAmountCents: row.fixedAmountCents?.toString() ?? null, minimumEligibleCents: row.minimumEligibleCents?.toString() ?? null, products: couponProduct_coupon.map(p => p.product), categories: couponCategory_coupon.map(c => c.category) }
}
const safe = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v))
export function createCouponAdministration(db) {
  return {
    list(actorId, page = 1) {
      return db.$transaction(async tx => {
        await requireAdministrator(tx, actorId)
        if (!Number.isInteger(page) || page < 1) throw new AccountError(400, 'Página inválida.')
        const total = await tx.coupon.count(), pages = Math.max(1, Math.ceil(total / 10)), current = Math.min(page, pages)
        const rows = await tx.coupon.findMany({ include, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 10, skip: (current - 1) * 10 })
        const counts = await tx.couponUsage.groupBy({ by: ['couponId', 'state'], where: { couponId: { in: rows.map(r => r.id) } }, _count: true })
        return { coupons: rows.map(row => ({ ...dto(row), uses: Object.fromEntries(['RESERVED', 'CONSUMED', 'RELEASED'].map(state => [state, counts.find(c => c.couponId === row.id && c.state === state)?._count ?? 0])) })), page: current, pages, total }
      })
    },
    options(actorId, query = '') {
      return db.$transaction(async tx => {
        await requireAdministrator(tx, actorId)
        const q = String(query).trim().slice(0, 120)
        return { products: await tx.product.findMany({ where: { deletedAt: null, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) }, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 30 }), categories: await tx.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) }
      })
    },
    save(actorId, input, id = null) {
      return db.$transaction(async tx => {
        await requireAdministrator(tx, actorId)
        const parsed = couponInput(input)
        let before = null
        if (id) {
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AccountError(400, 'Cupón inválido.')
          await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${id}::uuid FOR UPDATE`
          before = await tx.coupon.findUnique({ where: { id }, include })
          if (!before) throw new AccountError(404, 'Cupón no encontrado.')
          if (input.expectedVersion !== before.version) throw new AccountError(409, 'El cupón cambió. Cierra y vuelve a abrir la edición.')
          if (parsed.data.code !== before.code) throw new AccountError(400, 'El código no se puede cambiar. Crea otro cupón.')
          const uses = await tx.couponUsage.count({ where: { couponId: id, state: { in: ['RESERVED', 'CONSUMED'] } } })
          if (parsed.data.maxUses !== null && parsed.data.maxUses < uses) throw new AccountError(409, 'El límite no puede ser menor a los usos reservados y consumidos.')
        }
        for (const [model, ids] of [['product', parsed.productIds], ['category', parsed.categoryIds]]) {
          const retained = before ? (model === 'product' ? before.couponProduct_coupon.map(p => p.productId) : before.couponCategory_coupon.map(c => c.categoryId)) : []
          const added = ids.filter(id => !retained.includes(id))
          if (await tx[model].count({ where: { id: { in: added }, ...(model === 'product' ? { deletedAt: null } : { isActive: true }) } }) !== added.length) throw new AccountError(400, 'Hay productos o categorías que ya no están activos. Revisa la selección.')
        }
        const row = id ? await tx.coupon.update({ where: { id }, data: { ...parsed.data, version: { increment: 1 } } }) : await tx.coupon.create({ data: parsed.data })
        if (id) {
          await tx.couponProduct.deleteMany({ where: { couponId: id } })
          await tx.couponCategory.deleteMany({ where: { couponId: id } })
        }
        if (parsed.productIds.length) await tx.couponProduct.createMany({ data: parsed.productIds.map(productId => ({ couponId: row.id, productId })) })
        if (parsed.categoryIds.length) await tx.couponCategory.createMany({ data: parsed.categoryIds.map(categoryId => ({ couponId: row.id, categoryId })) })
        const coupon = dto(await tx.coupon.findUnique({ where: { id: row.id }, include }))
        await tx.auditEvent.create({ data: { actorId, actorType: 'ADMIN', entityType: 'Coupon', entityId: row.id, action: id ? 'UPDATE_COUPON' : 'CREATE_COUPON', reason: parsed.reason, ...(before ? { safeBefore: safe(dto(before)) } : {}), safeAfter: safe(coupon), correlationId: randomUUID() } })
        return { coupon }
      })
    },
  }
}
