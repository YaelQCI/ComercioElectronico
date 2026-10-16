import { getDatabase } from '../../utils/database.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { createPackageAdministration } from './manage-packages.js'
export async function packageAdministrationRequest(event, action) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (action !== 'list') requireCartOrigin(event)
  try {
    const identity = await accountIdentity(event), service = createPackageAdministration(getDatabase())
    if (action === 'list') return await service.list(identity.user.id)
    return await service.save(identity.user.id, await readBody(event), action === 'update' ? getRouterParam(event, 'id') : undefined)
  } catch (error) {
    throw createError({ statusCode: error instanceof AccountError ? error.status : error.code === 'P2002' ? 409 : 503, statusMessage: error instanceof AccountError ? error.message : error.code === 'P2002' ? 'Ya existe una caja con ese código.' : 'No pudimos guardar o consultar las cajas.' })
  }
}
