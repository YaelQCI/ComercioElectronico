import { randomUUID } from 'node:crypto'
import { AccountError, accountText, emailAddress, hashPassword } from '../accounts/credentials.js'
import { passwordConfirmationError } from '../../../shared/features/accounts/registration.js'
import { requireAdministrator } from '../../utils/authorization.js'

export function createAdministratorRegistration(db) {
  return async function registerAdministrator(actorId, input) {
    await db.$transaction(tx => requireAdministrator(tx, actorId))
    const confirmationError = passwordConfirmationError(input?.password, input?.passwordConfirmation)
    if (confirmationError) throw new AccountError(400, confirmationError)
    const emailNormalized = emailAddress(input?.email)
    const displayName = accountText(input?.displayName, 'Nombre')
    const reason = accountText(input?.reason, 'Motivo', 500)
    const passwordHash = await hashPassword(input?.password)
    try {
      return await db.$transaction(async tx => {
        await requireAdministrator(tx, actorId)
        const user = await tx.user.create({
          data: { email: input.email.trim(), emailNormalized, displayName, passwordHash, role: 'ADMIN' },
          select: { id: true, email: true, displayName: true, role: true },
        })
        await tx.auditEvent.create({ data: {
          actorId, actorType: 'ADMIN', entityType: 'User', entityId: user.id,
          action: 'REGISTER_ADMINISTRATOR', reason, safeAfter: { role: user.role }, correlationId: randomUUID(),
        } })
        return { user }
      })
    } catch (error) {
      if (error.code === 'P2002') throw new AccountError(409, 'Ya existe una cuenta con ese correo. No se modificaron sus permisos.')
      throw error
    }
  }
}
