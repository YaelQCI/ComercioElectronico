import { getDatabase } from '../../utils/database.js'
import { createStoreAdministration } from './manage-store.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { InventoryError } from '../../../shared/features/inventory/fefo.js'
import { requireCartOrigin } from '../cart/cart-http.js'
export async function administrationRequest(event, action) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (action !== 'users') requireCartOrigin(event)
  try {
    const identity = await accountIdentity(event), service = createStoreAdministration(getDatabase()), input = action === 'users' ? null : await readBody(event), target = getRouterParam(event, 'id')
    if (action === 'users') return { users: await service.users(identity.user.id, Number(getQuery(event).page ?? 1)) }
    if (action === 'create') return await service.createDraft(identity.user.id, input)
    if (action === 'product') return await service.updateProduct(identity.user.id, target, input)
    if (action === 'variant') return await service.updateVariant(identity.user.id, target, input)
    if (action === 'stock') return await service.adjustStock(identity.user.id, input)
    return await service.deactivateUser(identity.user.id, target, input)
  } catch (e) { const known = e instanceof AccountError || e instanceof InventoryError; throw createError({ statusCode: e instanceof AccountError ? e.status : e instanceof InventoryError ? 409 : e.code === 'P2002' ? 409 : 503, statusMessage: known ? e.message : e.code === 'P2002' ? 'Identificador comercial ya registrado.' : 'Operación administrativa no disponible.' }) }
}
