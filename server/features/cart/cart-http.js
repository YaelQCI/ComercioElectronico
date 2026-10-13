import { randomBytes, createHash } from 'node:crypto'
import { createCartRepository, CartError } from './cart-repository.js'
import { getDatabase } from '../../utils/database.js'

const cookie = 'fitness_cart'
function tokenHash(token) { return /^[a-f0-9]{64}$/.test(token ?? '') ? createHash('sha256').update(token).digest('hex') : null }
export const guestCartHash = event => tokenHash(getCookie(event, cookie))
export function requireCartOrigin(event) {
  if (!getHeader(event, 'origin') || getHeader(event, 'origin') !== getRequestURL(event).origin) throw createError({ statusCode: 403, statusMessage: 'Origen no autorizado.' })
}
export async function cartRequest(event, mutation = false) {
  setHeader(event, 'Cache-Control', 'no-store')
  let token = getCookie(event, cookie)
  if (mutation) {
    const origin = getHeader(event, 'origin')
    if (!origin || origin !== getRequestURL(event).origin) throw createError({ statusCode: 403, statusMessage: 'Origen no autorizado.' })
    if (!tokenHash(token)) {
      token = randomBytes(32).toString('hex')
      setCookie(event, cookie, token, { httpOnly: true, secure: !import.meta.dev, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 90 })
    }
  }
  try {
    const repository = createCartRepository(getDatabase())
    if (!mutation) return await repository.read(tokenHash(token))
    const input = await readBody(event)
    if (mutation === 'move') return await repository.move(tokenHash(token), input)
    if (mutation === 'edit' || mutation === 'remove') return await repository.edit(tokenHash(token), input, mutation === 'remove')
    return await repository.add(tokenHash(token), input)
  } catch (error) {
    throw createError({ statusCode: error instanceof CartError ? error.status : 503, statusMessage: error instanceof CartError ? error.message : 'No pudimos recuperar el carrito. Intenta de nuevo.' })
  }
}
