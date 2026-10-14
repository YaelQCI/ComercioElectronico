import { getDatabase } from '../../utils/database.js'
import { createAccounts, publicAccount } from './account-repository.js'
import { AccountError } from './credentials.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { limitRequest, RequestLimitError } from '../../utils/request-limit.js'

const accessCookie = 'fitness_access', refreshCookie = 'fitness_refresh'
export async function accountIdentity(event, required = true) {
  const identity = await createAccounts(getDatabase(), useRuntimeConfig(event).authSecret).authenticate(getCookie(event, accessCookie))
  if (required && !identity) throw new AccountError(401, 'Inicia sesión para continuar.')
  return identity
}
export function clearAccountCookies(event) { for (const key of [accessCookie, refreshCookie]) deleteCookie(event, key, { path: '/' }) }
export async function accountRequest(event, action) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (!['session', 'profile'].includes(action)) requireCartOrigin(event)
  try {
    const service = createAccounts(getDatabase(), useRuntimeConfig(event).authSecret)
    if (!['session', 'profile', 'logout'].includes(action)) {
      // Ignore X-Forwarded-For: trusting arbitrary proxy headers lets callers evade limits.
      await limitRequest(getDatabase(), `account:${action}:${getRequestIP(event, { xForwardedFor: false }) ?? 'unknown'}`, action === 'refresh' ? 60 : 10)
    }
    if (action === 'session') { const identity = await accountIdentity(event, false); return { user: identity ? publicAccount(identity.user) : null } }
    const input = ['profile', 'refresh', 'logout'].includes(action) ? {} : await readBody(event)
    if (['register', 'login', 'refresh'].includes(action)) {
      const result = action === 'refresh' ? await service.refresh(getCookie(event, refreshCookie)) : await service[action](input)
      const options = { httpOnly: true, secure: !import.meta.dev, sameSite: 'strict', path: '/' }
      setCookie(event, accessCookie, result.access, { ...options, maxAge: 900 })
      setCookie(event, refreshCookie, result.refresh, { ...options, expires: result.expiresAt })
      return { user: result.user }
    }
    if (action === 'logout') { const result = await service.logout(await accountIdentity(event, false), getCookie(event, refreshCookie)); clearAccountCookies(event); return result }
    const identity = await accountIdentity(event)
    if (action === 'profile') return await service.profile(identity.user.id)
    if (action === 'update') return { user: await service.updateProfile(identity.user.id, input) }
    if (action === 'address') return { address: await service.saveAddress(identity.user.id, input) }
    if (action === 'password' || action === 'deactivate') { const result = await service.password(identity.user.id, input, action === 'deactivate'); clearAccountCookies(event); return result }
    throw new AccountError(400, 'Operación inválida.')
  } catch (e) {
    if (action === 'refresh' && e instanceof AccountError && e.status === 401) clearAccountCookies(event)
    throw createError({ statusCode: e instanceof AccountError || e instanceof RequestLimitError ? e.status : 503, statusMessage: e instanceof AccountError || e instanceof RequestLimitError ? e.message : 'Cuenta no disponible. Intenta de nuevo.' })
  }
}
