import { randomUUID } from 'node:crypto'
import { passwordConfirmationError } from '../../../shared/features/accounts/registration.js'
import { validThemePreference } from '../../../shared/features/accounts/theme-preference.js'
import { AccountError, emailAddress, accountText, hashPassword, verifyPassword, opaqueToken, secretHash, issueAccess, verifyAccess } from './credentials.js'

export const publicAccount = u => ({ id: u.id, email: u.email, displayName: u.displayName, phone: u.phone, role: u.role, themePreference: u.themePreference, emailVerified: !!u.emailVerifiedAt })
export function createAccounts(db, secret) {
  async function lockedUser(tx, id) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`
    const user = await tx.user.findUnique({ where: { id } })
    if (!user || user.deletedAt) throw new AccountError(401, 'Inicia sesión para continuar.')
    return user
  }
  async function session(tx, user) {
    const expiresAt = new Date(Date.now() + 7 * 86400000), refresh = opaqueToken()
    const saved = await tx.authSession.create({ data: { userId: user.id, tokenFamilyId: randomUUID(), absoluteExpiresAt: expiresAt } })
    await tx.refreshCredential.create({ data: { sessionId: saved.id, tokenHash: secretHash(refresh), expiresAt } })
    return { user: publicAccount(user), access: issueAccess(user, saved, secret), refresh, expiresAt }
  }
  return {
    async register(input) {
      const confirmationError = passwordConfirmationError(input?.password, input?.passwordConfirmation)
      if (confirmationError) throw new AccountError(400, confirmationError)
      const email = emailAddress(input?.email), displayName = accountText(input?.displayName, 'Nombre'), passwordHash = await hashPassword(input?.password)
      try { return await db.$transaction(async tx => session(tx, await tx.user.create({ data: { email: input.email.trim(), emailNormalized: email, displayName, passwordHash, role: 'CUSTOMER' } }))) }
      catch (e) { if (e.code === 'P2002') throw new AccountError(409, 'No se pudo registrar la cuenta con esos datos.'); throw e }
    },
    async login(input) {
      const email = emailAddress(input?.email), candidate = await db.user.findUnique({ where: { emailNormalized: email } })
      if (!await verifyPassword(input?.password, candidate?.passwordHash) || !candidate || candidate.deletedAt) throw new AccountError(401, 'Correo o contraseña incorrectos.')
      return db.$transaction(async tx => {
        const user = await lockedUser(tx, candidate.id)
        if (user.passwordHash !== candidate.passwordHash) throw new AccountError(401, 'Correo o contraseña incorrectos.')
        return session(tx, user)
      })
    },
    async authenticate(access) {
      if (!access) return null
      const claims = verifyAccess(access, secret)
      if (!claims) return null
      const found = await db.authSession.findUnique({ where: { id: claims.sid }, include: { user: true } })
      if (!found || found.userId !== claims.sub || found.revokedAt || found.absoluteExpiresAt <= new Date() || found.user.deletedAt || found.user.authVersion !== claims.ver) return null
      return { user: found.user, sessionId: found.id, accessExpiresAt: new Date(claims.exp * 1000).toISOString() }
    },
    async refresh(token) {
      if (!/^[a-f0-9]{64}$/.test(token ?? '')) throw new AccountError(401, 'Sesión vencida. Inicia sesión de nuevo.')
      const result = await db.$transaction(async tx => {
        const credential = await tx.refreshCredential.findUnique({ where: { tokenHash: secretHash(token) }, include: { session: true } })
        if (!credential) return null
        const user = await lockedUser(tx, credential.session.userId)
        await tx.$queryRaw`SELECT id FROM "AuthSession" WHERE id = ${credential.sessionId}::uuid FOR UPDATE`
        const current = await tx.refreshCredential.findUnique({ where: { id: credential.id }, include: { session: true } })
        if (current.consumedAt) { await tx.authSession.update({ where: { id: current.sessionId }, data: { revokedAt: new Date(), revocationReason: 'Reutilización de renovación' } }); return null }
        if (current.revokedAt || current.expiresAt <= new Date() || current.session.revokedAt || current.session.absoluteExpiresAt <= new Date()) return null
        const refresh = opaqueToken(), replacement = await tx.refreshCredential.create({ data: { sessionId: current.sessionId, tokenHash: secretHash(refresh), expiresAt: current.session.absoluteExpiresAt } })
        await tx.refreshCredential.update({ where: { id: current.id }, data: { consumedAt: new Date(), replacedById: replacement.id } })
        await tx.authSession.update({ where: { id: current.sessionId }, data: { lastUsedAt: new Date() } })
        return { user: publicAccount(user), refresh, access: issueAccess(user, current.session, secret), expiresAt: current.session.absoluteExpiresAt }
      })
      if (!result) throw new AccountError(401, 'Sesión vencida. Inicia sesión de nuevo.')
      return result
    },
    async logout(identity, refresh) {
      if (identity) await db.authSession.updateMany({ where: { id: identity.sessionId, userId: identity.user.id, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: 'Cierre de sesión' } })
      else if (/^[a-f0-9]{64}$/.test(refresh ?? '')) {
        const credential = await db.refreshCredential.findUnique({ where: { tokenHash: secretHash(refresh) } })
        if (credential) await db.authSession.updateMany({ where: { id: credential.sessionId, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: 'Cierre de sesión' } })
      }
      return { ok: true }
    },
    async profile(userId) {
      const user = await db.user.findFirst({ where: { id: userId, deletedAt: null } })
      if (!user) throw new AccountError(401, 'Inicia sesión para continuar.')
      const addresses = await db.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })
      return { user: publicAccount(user), addresses }
    },
    async updateProfile(userId, input) {
      const displayName = accountText(input?.displayName, 'Nombre'), phone = input?.phone ? accountText(input.phone, 'Teléfono', 25) : null
      return db.$transaction(async tx => { await lockedUser(tx, userId); return publicAccount(await tx.user.update({ where: { id: userId }, data: { displayName, phone } })) })
    },
    async updateTheme(userId, input) {
      if (!validThemePreference(input?.themePreference)) throw new AccountError(400, 'Selecciona un tema claro, oscuro o del sistema.')
      return db.$transaction(async tx => {
        await lockedUser(tx, userId)
        return publicAccount(await tx.user.update({ where: { id: userId }, data: { themePreference: input.themePreference } }))
      })
    },
    async password(userId, input, deactivate = false) {
      const candidate = await db.user.findUnique({ where: { id: userId } })
      if (!candidate || !await verifyPassword(input?.currentPassword, candidate.passwordHash)) throw new AccountError(401, 'Contraseña actual incorrecta.')
      const passwordHash = deactivate ? null : await hashPassword(input?.password)
      await db.$transaction(async tx => {
        const user = await lockedUser(tx, userId)
        if (user.passwordHash !== candidate.passwordHash) throw new AccountError(409, 'La cuenta cambió. Intenta de nuevo.')
        await tx.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 }, ...(deactivate ? { deletedAt: new Date() } : { passwordHash }) } })
        await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: deactivate ? 'Cuenta desactivada' : 'Cambio de contraseña' } })
      })
      return { ok: true }
    },
    async saveAddress(userId, input) {
      const data = { countryCode: 'MX' }
      for (const key of ['recipientName', 'phone', 'postalCode', 'state', 'city', 'district', 'street', 'exteriorNumber']) data[key] = accountText(input?.[key], key, key === 'phone' ? 25 : 120)
      if (!/^\d{5}$/.test(data.postalCode)) throw new AccountError(400, 'Código postal inválido.')
      for (const key of ['label', 'interiorNumber', 'references']) data[key] = input?.[key] ? accountText(input[key], key, 250) : null
      if (input?.id && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.id)) throw new AccountError(400, 'Dirección inválida.')
      return db.$transaction(async tx => {
        await lockedUser(tx, userId)
        if (input.id && !await tx.address.findFirst({ where: { id: input.id, userId } })) throw new AccountError(404, 'Dirección no disponible.')
        data.isDefault = input.isDefault === true || !await tx.address.count({ where: { userId } })
        if (data.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
        return input.id ? tx.address.update({ where: { id: input.id }, data }) : tx.address.create({ data: { ...data, userId } })
      })
    },
  }
}
