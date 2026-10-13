import { randomUUID, createHash, createHmac } from 'node:crypto'
import { normalizeEmail } from '../../../shared/features/notifications/email.js'
import { availableFromLots } from '../../../shared/features/inventory/availability.js'

export class RestockError extends Error { constructor(status, message) { super(message); this.status = status } }
export function unsubscribeToken(id, secret) {
  const key = Buffer.from(secret ?? '', 'base64')
  if (key.length !== 32) throw new RestockError(503, 'Avisos de reposición no configurados. Intenta más tarde.')
  return createHmac('sha256', key).update(`restock:${id}`).digest('base64url')
}
export const cancellationHash = token => createHash('sha256').update(token).digest('hex')
export async function restockVariant(tx, id) {
  const variant = await tx.productVariant.findUnique({ where: { id }, include: { product: { include: { brand: true } }, inventoryLot_variant: { include: { warehouse: true } } } })
  const visible = variant && !variant.deletedAt && !variant.product.deletedAt && variant.product.publishedAt && variant.product.publishedAt <= new Date() && (!variant.product.brand || variant.product.brand.isActive)
  return { variant, visible, available: visible ? availableFromLots(variant.inventoryLot_variant) : 0 }
}
export function createRestockSubscriptions(db, secret) {
  return {
    async subscribe(input) {
      const email = normalizeEmail(input?.email)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input?.variantId ?? '') || input.consent !== true) throw new RestockError(400, 'Selecciona presentación y acepta recibir el aviso de reposición.')
      const id = randomUUID(), token = unsubscribeToken(id, secret)
      return db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${input.variantId}::uuid FOR UPDATE`
        const { variant, visible, available } = await restockVariant(tx, input.variantId)
        if (!visible) throw new RestockError(404, 'Presentación no disponible.')
        if (available) throw new RestockError(409, 'Esta presentación ya tiene existencias. Puedes agregarla al carrito.')
        const existing = await tx.restockSubscription.findFirst({ where: { variantId: variant.id, emailNormalized: email, state: { in: ['ACTIVE', 'PROCESSING'] } } })
        if (existing) return { subscribed: true, message: 'El correo ya tiene un aviso activo para esta presentación.', cancelPath: null }
        await tx.restockSubscription.create({ data: { id, variantId: variant.id, email: input.email.trim(), emailNormalized: email, unsubscribeTokenHash: cancellationHash(token) } })
        await tx.variantAvailability.upsert({ where: { variantId: variant.id }, create: { variantId: variant.id, isAvailable: false }, update: { isAvailable: false, checkedAt: new Date() } })
        return { subscribed: true, message: 'Interés registrado para esta presentación. El envío de avisos por correo está pendiente de configurar.', cancelPath: `/avisos/cancelar#token=${token}` }
      })
    },
    async cancel(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new RestockError(400, 'Enlace de cancelación inválido.')
      return db.$transaction(async tx => {
        const found = await tx.restockSubscription.findUnique({ where: { unsubscribeTokenHash: cancellationHash(token) } })
        if (!found) throw new RestockError(404, 'Enlace de cancelación no disponible.')
        await tx.$queryRaw`SELECT id FROM "RestockSubscription" WHERE id = ${found.id}::uuid FOR UPDATE`
        const current = await tx.restockSubscription.findUnique({ where: { id: found.id } })
        if (['ACTIVE', 'PROCESSING'].includes(current.state)) await tx.restockSubscription.update({ where: { id: found.id }, data: { state: 'CANCELED', canceledAt: new Date() } })
        return { canceled: true, message: current.state === 'NOTIFIED' ? 'Este aviso ya terminó; no se enviarán más correos de esta suscripción.' : 'Aviso cancelado. No se enviarán correos de esta suscripción.' }
      })
    },
  }
}
