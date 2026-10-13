import { getDatabase } from '../../utils/database.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { createRestockSubscriptions, RestockError } from './restock-subscriptions.js'
export async function restockRequest(event, action) {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  requireCartOrigin(event)
  try {
    const input = await readBody(event)
    const service = createRestockSubscriptions(getDatabase(), useRuntimeConfig(event).restockTokenSecret)
    return action === 'subscribe' ? await service.subscribe(input) : await service.cancel(input?.token)
  } catch (error) {
    const statusCode = error instanceof RestockError ? error.status : error instanceof RangeError ? 400 : 503
    throw createError({ statusCode, statusMessage: error instanceof RestockError || error instanceof RangeError ? error.message : 'No pudimos actualizar el aviso. Vuelve a intentar.' })
  }
}
