import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
export function reviewId(id) { if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id ?? '')) throw new AccountError(400, 'Identificador inválido.'); return id }
export function reviewInput(input) {
  if (!Number.isInteger(input?.rating) || input.rating < 1 || input.rating > 5) throw new AccountError(400, 'Calificación inválida: elige de 1 a 5.')
  return { rating: input.rating, body: accountText(input.body, 'Reseña', 4000), title: input.title ? accountText(input.title, 'Título', 120) : null }
}
export function createReviews(db) {
  return {
    async list(productId, page = 1) {
      reviewId(productId)
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new AccountError(400, 'Página inválida.')
      return db.$transaction(async tx => {
        if (!await tx.product.findFirst({ where: { id: productId, deletedAt: null, publishedAt: { lte: new Date() } } })) throw new AccountError(404, 'Producto no disponible.')
        const where = { productId, hiddenAt: null }
        const groups = await tx.review.groupBy({ by: ['rating'], where, _count: { _all: true } })
        const distribution = Object.fromEntries([1,2,3,4,5].map(r => [r, groups.find(g => g.rating === r)?._count._all ?? 0]))
        const total = Object.values(distribution).reduce((a,b) => a+b, 0)
        const rows = await tx.review.findMany({ where, skip: (page-1)*10, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { user: { select: { displayName: true, deletedAt: true } } } })
        return { page, total, pages: Math.ceil(total/10), average: total ? groups.reduce((sum,g) => sum + g.rating*g._count._all, 0)/total : null, distribution, reviews: rows.map(r => ({ id: r.id, author: r.user.deletedAt ? 'Cuenta desactivada' : r.user.displayName, rating: r.rating, title: r.title, body: r.body, createdAt: r.createdAt.toISOString(), editedAt: r.editedAt?.toISOString() ?? null, verified: true })) }
      }, { isolationLevel: 'RepeatableRead' })
    },
    async mine(userId, productId) { reviewId(productId); return db.review.findUnique({ where: { userId_productId: { userId, productId } }, select: { rating: true, title: true, body: true, editedAt: true, hiddenAt: true } }) },
    async publish(userId, productId, input) {
      reviewId(productId); const data = reviewInput(input)
      return db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user || user.deletedAt) throw new AccountError(401, 'Inicia sesión para continuar.')
        if (!await tx.product.findFirst({ where: { id: productId, deletedAt: null, publishedAt: { lte: new Date() } } })) throw new AccountError(404, 'Producto no disponible.')
        const unit = await tx.orderUnit.findFirst({ where: { variant: { productId }, order: { userId, status: 'DELIVERED' } }, orderBy: { id: 'asc' } })
        if (!unit) throw new AccountError(403, 'Solo puedes reseñar productos de un pedido entregado vinculado a tu cuenta.')
        const existing = await tx.review.findUnique({ where: { userId_productId: { userId, productId } } })
        if (existing) await tx.review.update({ where: { id: existing.id }, data: { ...data, editedAt: new Date() } })
        else await tx.review.create({ data: { ...data, userId, productId, verifiedOrderUnitId: unit.id } })
        return { ok: true, hidden: !!existing?.hiddenAt }
      })
    },
    async moderate(adminId, id, input) {
      reviewId(id)
      if (!['HIDE', 'RESTORE'].includes(input?.action)) throw new AccountError(400, 'Moderación inválida.')
      const reason = accountText(input.reason, 'Motivo', 500)
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "Review" WHERE id = ${id}::uuid FOR UPDATE`
        const review = await tx.review.findUnique({ where: { id } })
        if (!review) throw new AccountError(404, 'Reseña no disponible.')
        const hidden = input.action === 'HIDE'
        if (hidden === !!review.hiddenAt) return { ok: true, changed: false }
        await tx.review.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } })
        await tx.reviewModeration.create({ data: { reviewId: id, adminId, action: input.action, reason } })
        return { ok: true, changed: true }
      })
    },
  }
}
