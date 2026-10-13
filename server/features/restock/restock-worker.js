import { restockVariant, unsubscribeToken, cancellationHash } from './restock-subscriptions.js'

export function applicationUrl(value) {
  const url = new URL(value)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Configurar URL raíz pública de la tienda.')
  return url.origin
}
export async function observeRestock(db, variantId, siteUrl) {
  const base = applicationUrl(siteUrl)
  return db.$transaction(async tx => {
    await tx.variantAvailability.upsert({ where: { variantId }, create: { variantId, isAvailable: false }, update: {} })
    await tx.$queryRaw`SELECT "variantId" FROM "VariantAvailability" WHERE "variantId" = ${variantId}::uuid FOR UPDATE`
    const previous = await tx.variantAvailability.findUnique({ where: { variantId } })
    const { variant, available } = await restockVariant(tx, variantId)
    const current = available > 0
    await tx.variantAvailability.update({ where: { variantId }, data: { isAvailable: current, checkedAt: new Date() } })
    if (previous.isAvailable || !current) return 0
    const subscriptions = await tx.restockSubscription.findMany({ where: { variantId, state: 'ACTIVE' }, orderBy: { id: 'asc' } })
    let queued = 0
    for (const subscription of subscriptions) {
      const result = await tx.outboxMessage.createMany({ data: [{ kind: 'RESTOCK_NOTICE', aggregateType: 'RestockSubscription', aggregateId: subscription.id, deduplicationKey: `restock:${subscription.id}`, payload: { variantId, productId: variant.productId, name: variant.product.name, sku: variant.sku, presentation: `${variant.presentationLabel} · ${variant.flavor}`, email: subscription.emailNormalized, siteUrl: base } }], skipDuplicates: true })
      queued += result.count
    }
    return queued
  })
}
export async function deliverRestock(db, messageId, { mailer, tokenSecret }) {
  if (typeof mailer?.send !== 'function') throw new Error('Proveedor de correo no configurado.')
  unsubscribeToken(messageId, tokenSecret)
  const windowMs = Number.isSafeInteger(mailer.idempotencyWindowMs) && mailer.idempotencyWindowMs > 0 ? mailer.idempotencyWindowMs : 0
  const safeWindowMs = windowMs - Math.min(3600000, Math.floor(windowMs / 10))
  const claimed = await db.$transaction(async tx => {
    const locked = await tx.$queryRaw`SELECT id FROM "OutboxMessage" WHERE id = ${messageId}::uuid FOR UPDATE SKIP LOCKED`
    if (!locked.length) return null
    const message = await tx.outboxMessage.findUnique({ where: { id: messageId } })
    const now = new Date()
    if (message.kind !== 'RESTOCK_NOTICE' || !['PENDING', 'PROCESSING'].includes(message.state) || message.nextAttemptAt > now) return null
    const subscription = await tx.restockSubscription.findUnique({ where: { id: message.aggregateId } })
    if (!subscription || ['CANCELED', 'NOTIFIED'].includes(subscription.state)) {
      await tx.outboxMessage.update({ where: { id: message.id }, data: { state: 'PROCESSED', processedAt: now } })
      return null
    }
    const firstAttemptAt = message.payload.firstAttemptAt ? new Date(message.payload.firstAttemptAt) : null
    if (firstAttemptAt && (!Number.isFinite(firstAttemptAt.getTime()) || !safeWindowMs || now - firstAttemptAt >= safeWindowMs)) {
      await tx.outboxMessage.update({ where: { id: message.id }, data: { state: 'FAILED', lastError: 'Requiere revisión manual: ventana segura de idempotencia agotada.' } })
      return null
    }
    if (!(await restockVariant(tx, subscription.variantId)).available) {
      await tx.outboxMessage.update({ where: { id: message.id }, data: { state: 'PENDING', nextAttemptAt: new Date(now.getTime() + 60000) } })
      return null
    }
    return tx.outboxMessage.update({ where: { id: message.id }, data: { state: 'PROCESSING', attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + 90000), payload: { ...message.payload, firstAttemptAt: firstAttemptAt?.toISOString() ?? now.toISOString() } } })
  })
  if (!claimed) return { sent: false }
  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "OutboxMessage" WHERE id = ${claimed.id}::uuid FOR UPDATE`
      const message = await tx.outboxMessage.findUnique({ where: { id: claimed.id } })
      if (message.state !== 'PROCESSING' || message.attempts !== claimed.attempts) return { sent: false }
      await tx.$queryRaw`SELECT id FROM "RestockSubscription" WHERE id = ${message.aggregateId}::uuid FOR UPDATE`
      const subscription = await tx.restockSubscription.findUnique({ where: { id: message.aggregateId } })
      if (!subscription || ['CANCELED', 'NOTIFIED'].includes(subscription.state)) {
        await tx.outboxMessage.update({ where: { id: message.id }, data: { state: 'PROCESSED', processedAt: new Date() } })
        return { sent: false }
      }
      if (!(await restockVariant(tx, subscription.variantId)).available) {
        await tx.outboxMessage.update({ where: { id: message.id }, data: { state: 'PENDING', nextAttemptAt: new Date(Date.now() + 60000) } })
        return { sent: false }
      }
      const payload = message.payload, base = applicationUrl(payload.siteUrl)
      const token = unsubscribeToken(subscription.id, tokenSecret)
      if (cancellationHash(token) !== subscription.unsubscribeTokenHash) throw new Error('Clave de cancelación incompatible con el registro.')
      const text = `${payload.name}\n${payload.presentation}\nSKU ${payload.sku}\n\nLa presentación volvió a tener existencias vendibles. La disponibilidad puede cambiar; este aviso no reserva productos.\n${base}/producto/${payload.productId}?variante=${payload.variantId}\n\nNo recibirás más avisos de esta suscripción. Para cancelarla: ${base}/avisos/cancelar#token=${token}`
      await tx.restockSubscription.update({ where: { id: subscription.id }, data: { state: 'PROCESSING' } })
      const receipt = await mailer.send({ to: payload.email, subject: `Reposición: ${payload.name}`, text, idempotencyKey: message.deduplicationKey })
      if (!receipt?.id) throw new Error('Sin aceptación del proveedor')
      const now = new Date()
      await tx.restockSubscription.update({ where: { id: subscription.id }, data: { state: 'NOTIFIED', notifiedAt: now } })
      await tx.outboxMessage.update({ where: { id: message.id }, data: { state: 'PROCESSED', processedAt: now, lastError: null, payload: { ...payload, providerMessageId: receipt.id } } })
      return { sent: true }
    }, { timeout: 20000 })
  } catch {
    await db.outboxMessage.updateMany({ where: { id: claimed.id, state: 'PROCESSING', attempts: claimed.attempts }, data: { state: safeWindowMs ? 'PENDING' : 'FAILED', nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(6, claimed.attempts))), lastError: safeWindowMs ? 'Entrega sin confirmación; reintento con la misma clave de idempotencia.' : 'Entrega incierta sin idempotencia del proveedor; requiere reconciliación manual.' } })
    return { sent: false, retry: !!safeWindowMs }
  }
}
export async function processRestock(db, dependencies, { limit = 50 } = {}) {
  if (typeof dependencies.mailer?.send !== 'function') throw new Error('Proveedor de correo no configurado.')
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Límite de procesamiento inválido.')
  const tracked = await db.variantAvailability.findMany({ orderBy: [{ checkedAt: 'asc' }, { variantId: 'asc' }], take: limit })
  let queued = 0, sent = 0
  for (const record of tracked) queued += await observeRestock(db, record.variantId, dependencies.siteUrl)
  const messages = await db.outboxMessage.findMany({ where: { kind: 'RESTOCK_NOTICE', state: { in: ['PENDING', 'PROCESSING'] }, nextAttemptAt: { lte: new Date() } }, orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: limit })
  for (const message of messages) if ((await deliverRestock(db, message.id, dependencies)).sent) sent++
  return { observed: tracked.length, queued, processed: messages.length, sent }
}
