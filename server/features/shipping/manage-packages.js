import { randomUUID } from 'node:crypto'
import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { packageConfiguration } from '../../../shared/features/shipping/package-configuration.js'

const snapshot = box => Object.fromEntries(['code', 'isActive', 'innerLengthMm', 'innerWidthMm', 'innerHeightMm', 'outerLengthMm', 'outerWidthMm', 'outerHeightMm', 'tareWeightGrams', 'maxGrossWeightGrams', 'version'].map(key => [key, box[key]]))
export function createPackageAdministration(db) {
  return {
    list(adminId) {
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        return { packages: await tx.packageType.findMany({ orderBy: [{ code: 'asc' }, { id: 'asc' }] }) }
      })
    },
    async save(adminId, input, target) {
      let data
      try { data = packageConfiguration(input) } catch (error) { throw new AccountError(400, error.message) }
      const reason = accountText(input?.reason, 'Motivo', 500)
      if (target && (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(target) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1)) throw new AccountError(400, 'Identificador o versión de caja inválidos.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        let before
        if (target) {
          await tx.$queryRaw`SELECT id FROM "PackageType" WHERE id = ${target}::uuid FOR UPDATE`
          before = await tx.packageType.findUnique({ where: { id: target } })
          if (!before) throw new AccountError(404, 'Caja no encontrada.')
          if (before.version !== input.expectedVersion) throw new AccountError(409, 'La caja cambió. Actualiza la lista y vuelve a abrir el formulario.')
        }
        const saved = target
          ? await tx.packageType.update({ where: { id: target }, data: { ...data, version: { increment: 1 } } })
          : await tx.packageType.create({ data })
        await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', entityType: 'PackageType', entityId: saved.id, action: target ? 'UPDATE_PACKAGE' : 'CREATE_PACKAGE', reason, safeBefore: before ? snapshot(before) : undefined, safeAfter: snapshot(saved), correlationId: randomUUID() } })
        return saved
      })
    },
  }
}
