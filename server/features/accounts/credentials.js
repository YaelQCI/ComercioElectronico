import { randomBytes, scrypt, timingSafeEqual, createHmac, createHash } from 'node:crypto'
import { promisify } from 'node:util'

const derive = promisify(scrypt)
const parameters = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }
export class AccountError extends Error { constructor(status, message) { super(message); this.status = status } }
export function emailAddress(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new AccountError(400, 'Correo inválido.')
  return value.trim().toLowerCase()
}
export function accountText(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw new AccountError(400, `${label} inválido.`)
  return value.trim()
}
export function validPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value) > 256) throw new AccountError(400, 'La contraseña debe tener al menos 12 caracteres y hasta 256 bytes.')
  return value
}
export async function hashPassword(password) {
  validPassword(password)
  const salt = randomBytes(16).toString('hex'), key = await derive(password, salt, 64, parameters)
  return `scrypt:131072:8:1:${salt}:${key.toString('hex')}`
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 256) return false
  const match = /^scrypt:131072:8:1:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored ?? '')
  // Perform equal-cost work for unknown accounts and legacy/invalid hashes.
  const key = await derive(password, match?.[1] ?? '0'.repeat(32), 64, parameters)
  return !!match && timingSafeEqual(key, Buffer.from(match[2], 'hex'))
}
export const opaqueToken = () => randomBytes(32).toString('hex')
export const secretHash = value => createHash('sha256').update(value).digest('hex')
function signingKey(secret) {
  if (typeof secret !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(secret) || Buffer.from(secret, 'base64').length !== 32) throw new AccountError(503, 'Autenticación pendiente de configurar.')
  return Buffer.from(secret, 'base64')
}
export function issueAccess(user, session, secret, now = Date.now()) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const seconds = Math.floor(now / 1000)
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'the-fitness-stuff', aud: 'fitness-account', sub: user.id, sid: session.id, ver: user.authVersion, iat: seconds, exp: Math.min(seconds + 900, Math.floor(session.absoluteExpiresAt.getTime() / 1000)) })}`
  return `${body}.${createHmac('sha256', signingKey(secret)).update(body).digest('base64url')}`
}
export function verifyAccess(token, secret, now = Date.now()) {
  const key = signingKey(secret)
  try {
    if (typeof token !== 'string' || token.length > 2048) return null
    const parts = token.split('.')
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null
    const signature = Buffer.from(parts[2], 'base64url'), expected = createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest()
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null
    const header = JSON.parse(Buffer.from(parts[0], 'base64url')), data = JSON.parse(Buffer.from(parts[1], 'base64url')), seconds = Math.floor(now / 1000)
    const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
    if (header.alg !== 'HS256' || header.typ !== 'JWT' || data.iss !== 'the-fitness-stuff' || data.aud !== 'fitness-account' || !uuid.test(data.sub) || !uuid.test(data.sid) || !Number.isInteger(data.ver) || !Number.isInteger(data.iat) || !Number.isInteger(data.exp) || data.iat > seconds || data.exp <= seconds || data.exp - data.iat > 900) return null
    return data
  } catch { return null }
}
