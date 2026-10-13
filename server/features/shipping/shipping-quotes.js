import { createHash } from 'node:crypto'
import { shippingCart, CartError } from '../cart/cart-repository.js'
import { choosePackage } from '../../../shared/features/shipping/pack-order.js'
import { shippingProgress } from '../../../shared/features/shipping/shipping-policy.js'
import { rateAddress } from './envia-rates.js'

export class ShippingError extends Error { constructor(status, message) { super(message); this.status = status } }
export async function prepareShipping(tx, hash, input) {
  let destination
  try { destination = rateAddress(input) } catch (error) { throw new ShippingError(400, error.message) }
  const cart = await shippingCart(tx, hash)
  const warehouse = await tx.warehouse.findUnique({ where: { singletonKey: 1 } })
  if (!warehouse) throw new ShippingError(503, 'Almacén no configurado para cotización.')
  const origin = rateAddress({ name: warehouse.recipientName, phone: warehouse.phone, street: `${warehouse.street} ${warehouse.exteriorNumber}${warehouse.interiorNumber ? ` int. ${warehouse.interiorNumber}` : ''}`, city: warehouse.city, state: warehouse.state, country: warehouse.countryCode, postalCode: warehouse.postalCode })
  const boxes = await tx.packageType.findMany({ where: { isActive: true } })
  const parcel = choosePackage(cart.units, boxes)
  const fingerprint = createHash('sha256').update(JSON.stringify({ cart: { id: cart.cartId, version: cart.version, baseCents: cart.baseCents, lines: cart.lines, units: cart.units }, origin: { id: warehouse.id, version: warehouse.configurationVersion, ...origin }, destination, parcel })).digest('hex')
  return { ...cart, origin, destination, parcel, fingerprint }
}
function dto(quote, prepared) {
  return { id: quote.id, cartVersion: prepared.version, carrierCode: quote.carrierCode, serviceCode: quote.serviceCode, serviceName: quote.serviceName, currency: quote.currency, quotedAt: quote.quotedAt.toISOString(), expiresAt: quote.expiresAt?.toISOString() ?? null, deliveryEstimate: quote.sanitizedResponse.deliveryEstimate ?? null, destination: quote.destinationSnapshot, ...shippingProgress(prepared.baseCents, quote.quotedAmountCents.toString()) }
}
export function createShippingQuotes(db, provider) {
  return {
    async quote(hash, destination) {
      const prepared = await db.$transaction(tx => prepareShipping(tx, hash, destination), { isolationLevel: 'RepeatableRead' })
      const rates = await provider.quote({ origin: prepared.origin, destination: prepared.destination, package: prepared.parcel, goodsCents: prepared.baseCents, content: prepared.content })
      return db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${prepared.cartId}::uuid FOR UPDATE`
        const fresh = await prepareShipping(tx, hash, destination)
        if (fresh.fingerprint !== prepared.fingerprint) throw new ShippingError(409, 'Carrito o empaque cambiaron durante la cotización. Vuelve a cotizar.')
        await tx.shippingQuote.updateMany({ where: { cartId: prepared.cartId, status: { in: ['AVAILABLE', 'ACCEPTED'] } }, data: { status: 'INVALIDATED' } })
        const quotes = []
        for (const rate of rates) {
          const saved = await tx.shippingQuote.create({ data: { cartId: prepared.cartId, requestFingerprint: prepared.fingerprint, provider: 'ENVIA', carrierCode: rate.carrierCode, serviceCode: rate.serviceCode, serviceName: rate.serviceName, quotedAmountCents: BigInt(rate.quotedAmountCents), currency: rate.currency, originSnapshot: prepared.origin, destinationSnapshot: prepared.destination, packageSnapshot: prepared.parcel, sanitizedResponse: { deliveryEstimate: rate.deliveryEstimate, baseCents: prepared.baseCents, chargedAmountCents: shippingProgress(prepared.baseCents, rate.quotedAmountCents).chargedAmountCents } } })
          quotes.push(dto(saved, prepared))
        }
        return { cartVersion: prepared.version, quotes }
      })
    },
    async select(hash, quoteId, destination) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId ?? '')) throw new ShippingError(400, 'Cotización inválida.')
      return db.$transaction(async tx => {
        const cart = await shippingCart(tx, hash)
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.cartId}::uuid FOR UPDATE`
        const prepared = await prepareShipping(tx, hash, destination)
        const quote = await tx.shippingQuote.findFirst({ where: { id: quoteId, cartId: prepared.cartId, status: { in: ['AVAILABLE', 'ACCEPTED'] } } })
        if (!quote) throw new ShippingError(404, 'Cotización no disponible en tu carrito.')
        if (quote.requestFingerprint !== prepared.fingerprint || Date.now() - quote.quotedAt.getTime() > 600000 || (quote.expiresAt && quote.expiresAt <= new Date())) throw new ShippingError(409, 'La cotización requiere actualización. Vuelve a cotizar y acepta la tarifa vigente.')
        await tx.shippingQuote.updateMany({ where: { cartId: prepared.cartId, status: 'ACCEPTED', id: { not: quote.id } }, data: { status: 'AVAILABLE' } })
        await tx.shippingQuote.update({ where: { id: quote.id }, data: { status: 'ACCEPTED' } })
        return dto(quote, prepared)
      })
    },
    async selected(hash) {
      if (!hash) return null
      try {
        return await db.$transaction(async tx => {
          const cart = await shippingCart(tx, hash)
          const quote = await tx.shippingQuote.findFirst({ where: { cartId: cart.cartId, status: 'ACCEPTED' }, orderBy: { updatedAt: 'desc' } })
          if (!quote || Date.now() - quote.quotedAt.getTime() > 600000 || (quote.expiresAt && quote.expiresAt <= new Date())) return null
          const prepared = await prepareShipping(tx, hash, quote.destinationSnapshot)
          return prepared.fingerprint === quote.requestFingerprint ? dto(quote, prepared) : null
        }, { isolationLevel: 'RepeatableRead' })
      } catch (error) { if (error instanceof CartError || error instanceof ShippingError || error instanceof RangeError) return null; throw error }
    },
  }
}
