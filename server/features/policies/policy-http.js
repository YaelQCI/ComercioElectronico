import { getDatabase } from '../../utils/database.js'
import { createPolicies } from './policy-repository.js'
import { AccountError } from '../accounts/credentials.js'
import { accountIdentity } from '../accounts/account-http.js'
import { requireCartOrigin } from '../cart/cart-http.js'
export async function policyRequest(event, publish = false) {
  if (publish) { requireCartOrigin(event); setHeader(event, 'Cache-Control', 'no-store') }
  try {
    const repository = createPolicies(getDatabase()), slug = getRouterParam(event, 'slug')
    if (!publish) return { policy: await repository.published(slug) }
    const identity = await accountIdentity(event)
    return await repository.publish(identity.user.id, slug, await readBody(event))
  } catch (e) { throw createError({ statusCode: e instanceof AccountError ? e.status : 503, statusMessage: e instanceof AccountError ? e.message : 'Política no disponible. Intenta de nuevo.' }) }
}
