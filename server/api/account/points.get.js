import { getDatabase } from '../../utils/database.js'
import { accountIdentity } from '../../features/accounts/account-http.js'
import { AccountError } from '../../features/accounts/credentials.js'
import { readLoyalty } from '../../features/loyalty/loyalty-repository.js'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  try { const identity = await accountIdentity(event); return await readLoyalty(getDatabase(), identity.user.id, Number(getQuery(event).page ?? 1)) }
  catch (e) { throw createError({ statusCode: e instanceof AccountError ? e.status : 503, statusMessage: e instanceof AccountError ? e.message : 'Puntos no disponibles.' }) }
})
