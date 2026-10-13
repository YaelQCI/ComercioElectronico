import { getDatabase } from '../../utils/database.js'
import { guestCartHash, requireCartOrigin } from '../cart/cart-http.js'
import { CartError } from '../cart/cart-repository.js'
import { createEnviaRates, ShippingProviderError } from './envia-rates.js'
import { PackingError } from '../../../shared/features/shipping/pack-order.js'
import { createShippingQuotes, ShippingError } from './shipping-quotes.js'
export async function shippingRequest(event, action) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (action !== 'selected') requireCartOrigin(event)
  try {
    const config = useRuntimeConfig(event)
    const provider = action === 'quote' ? createEnviaRates({ token: config.enviaToken, environment: config.enviaEnvironment, carrier: config.enviaCarrier }) : null
    const service = createShippingQuotes(getDatabase(), provider), hash = guestCartHash(event)
    if (action === 'selected') return { selected: await service.selected(hash) }
    const input = await readBody(event)
    if (!input || typeof input !== 'object') throw new ShippingError(400, 'Destino inválido.')
    if (action === 'select') return { selected: await service.select(hash, input.quoteId, input.destination) }
    return await service.quote(hash, input.destination)
  } catch (error) {
    const status = error instanceof CartError || error instanceof ShippingError ? error.status : error instanceof RangeError ? 400 : error instanceof PackingError ? 409 : 503
    const known = error instanceof CartError || error instanceof ShippingError || error instanceof PackingError || error instanceof ShippingProviderError || error instanceof RangeError
    throw createError({ statusCode: status, statusMessage: known ? error.message : 'Cotización no disponible. Vuelve a intentar.' })
  }
}
