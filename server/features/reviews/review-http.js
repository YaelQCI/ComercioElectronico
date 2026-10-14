import { getDatabase } from '../../utils/database.js'
import { createReviews } from './review-repository.js'
import { AccountError } from '../accounts/credentials.js'
import { accountIdentity } from '../accounts/account-http.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { limitRequest, RequestLimitError } from '../../utils/request-limit.js'
export async function reviewRequest(event, action = 'list') {
  if (action !== 'list') setHeader(event, 'Cache-Control', 'no-store')
  if (['publish', 'moderate'].includes(action)) requireCartOrigin(event)
  try {
    const service = createReviews(getDatabase()), id = getRouterParam(event, 'id')
    if (action === 'list') return await service.list(id, Number(getQuery(event).page ?? 1))
    const identity = await accountIdentity(event)
    if (action === 'mine') return { review: await service.mine(identity.user.id, id) }
    await limitRequest(getDatabase(), `reviews:${identity.user.id}`, 20)
    const input = await readBody(event)
    return action === 'publish' ? await service.publish(identity.user.id, id, input) : await service.moderate(identity.user.id, id, input)
  } catch (e) { const known = e instanceof AccountError || e instanceof RequestLimitError; throw createError({ statusCode: known ? e.status : 503, statusMessage: known ? e.message : 'Reseñas no disponibles. Intenta de nuevo.' }) }
}
