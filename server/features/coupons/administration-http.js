import { getDatabase } from '../../utils/database.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { createCouponAdministration } from './manage-coupons.js'

export async function couponAdministrationRequest(event, action) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (action === 'save') requireCartOrigin(event)
  try {
    const identity = await accountIdentity(event), service = createCouponAdministration(getDatabase())
    if (action === 'list') return await service.list(identity.user.id, Number(getQuery(event).page ?? 1))
    if (action === 'options') return await service.options(identity.user.id, getQuery(event).q)
    return await service.save(identity.user.id, await readBody(event), getRouterParam(event, 'id'))
  } catch (error) {
    throw createError({ statusCode: error instanceof AccountError ? error.status : error.code === 'P2002' ? 409 : 503, statusMessage: error instanceof AccountError ? error.message : error.code === 'P2002' ? 'Ya existe un cupón con ese código.' : 'No pudimos administrar los cupones. Intenta nuevamente.' })
  }
}
