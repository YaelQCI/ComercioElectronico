import { getDatabase } from '../../utils/database.js'
import { createOrders } from './order-repository.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { requireCartOrigin } from '../cart/cart-http.js'
export async function orderRequest(event, action = 'list', administrative = false) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (action === 'advance') requireCartOrigin(event)
  try {
    const identity = await accountIdentity(event), service = createOrders(getDatabase()), id = getRouterParam(event, 'id')
    if (action === 'list') return await service.list(identity.user.id, Number(getQuery(event).page ?? 1), administrative)
    if (action === 'read') return { order: await service.read(identity.user.id, id, administrative) }
    return await service.advance(identity.user.id, id, await readBody(event))
  } catch (e) { throw createError({ statusCode: e instanceof AccountError ? e.status : 503, statusMessage: e instanceof AccountError ? e.message : 'Pedidos no disponibles. Intenta de nuevo.' }) }
}
