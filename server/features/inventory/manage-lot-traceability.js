import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { lotTraceability } from '../../../shared/features/inventory/lot-traceability.js'

export const maxCertificateBytes = 20 * 1024 * 1024
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
export function createCertificateStorage(directory) {
  const root = resolve(directory, 'certificates')
  const path = key => {
    if (!/^uploaded-certificates\/[a-f0-9-]{36}\.pdf$/.test(key)) throw new AccountError(400, 'Certificado inválido.')
    return resolve(root, key.slice('uploaded-certificates/'.length))
  }
  return {
    async write(bytes) { await mkdir(root, { recursive: true }); const key = `uploaded-certificates/${randomUUID()}.pdf`; await writeFile(path(key), bytes, { flag: 'wx', mode: 0o600 }); return key },
    async remove(key) { await unlink(path(key)) },
    async read(asset) {
      if (asset?.mimeType !== 'application/pdf' || BigInt(asset.byteSize) > BigInt(maxCertificateBytes)) return null
      try {
        const file = await stat(path(asset.storageKey))
        if (!file.isFile() || BigInt(file.size) !== BigInt(asset.byteSize) || file.size > maxCertificateBytes) return null
        const bytes = await readFile(path(asset.storageKey))
        return bytes.subarray(0, 5).toString() === '%PDF-' && BigInt(bytes.length) === BigInt(asset.byteSize) && createHash('sha256').update(bytes).digest('hex') === asset.checksum ? bytes : null
      } catch { return null }
    },
  }
}
export function createLotTraceabilityAdministration(db, storage) {
  return {
    async save(adminId, lotId, input, certificate) {
      if (!uuid(lotId) || !Number.isInteger(input?.expectedVersion) || input.expectedVersion < 1) throw new AccountError(400, 'Lote o versión inválidos.')
      const reason = accountText(input.reason, 'Motivo', 500)
      let data
      try { const trace = lotTraceability(input); data = { ...trace, importedOn: trace.importedOn ? new Date(`${trace.importedOn}T00:00:00Z`) : null }; for (const key of Object.keys(data)) if (!(key in input)) delete data[key] } catch (error) { throw new AccountError(400, error.message) }
      if (certificate && (!Buffer.isBuffer(certificate.bytes) || !certificate.bytes.length || certificate.bytes.length > maxCertificateBytes)) throw new AccountError(413, 'El certificado debe pesar entre 1 byte y 20 MB.')
      if (certificate && (certificate.mimeType !== 'application/pdf' || certificate.bytes.subarray(0, 5).toString() !== '%PDF-' || !certificate.bytes.subarray(-1024).includes(Buffer.from('%%EOF')))) throw new AccountError(400, 'Selecciona un archivo PDF válido.')
      if (input.removeCertificate !== undefined && typeof input.removeCertificate !== 'boolean') throw new AccountError(400, 'Acción de certificado inválida.')
      if (certificate && input.removeCertificate) throw new AccountError(400, 'Carga o retira el certificado en acciones separadas.')
      let key
      try {
        return await db.$transaction(async tx => {
          await requireAdministrator(tx, adminId)
          await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE id=${lotId}::uuid FOR UPDATE`
          const lot = await tx.inventoryLot.findUnique({ where: { id: lotId } })
          if (!lot) throw new AccountError(404, 'Lote no disponible.')
          if (lot.version !== input.expectedVersion) throw new AccountError(409, 'El lote cambió. Actualiza la lista antes de editar su trazabilidad.')
          if (certificate) {
            key = await storage.write(certificate.bytes)
            const asset = await tx.mediaAsset.create({ data: { storageKey: key, mimeType: 'application/pdf', byteSize: BigInt(certificate.bytes.length), checksum: createHash('sha256').update(certificate.bytes).digest('hex'), createdById: adminId } })
            data.certificateAssetId = asset.id
          } else if (input.removeCertificate) data.certificateAssetId = null
          const saved = await tx.inventoryLot.update({ where: { id: lotId }, data: { ...data, version: { increment: 1 } } })
          const snapshot = value => ({ origin: value.origin, customsEntry: value.customsEntry, importedOn: value.importedOn?.toISOString().slice(0, 10) ?? null, certificateAssetId: value.certificateAssetId, version: value.version })
          await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', entityType: 'InventoryLot', entityId: lotId, action: 'UPDATE_LOT_TRACEABILITY', reason, safeBefore: snapshot(lot), safeAfter: snapshot(saved), correlationId: randomUUID() } })
          return { id: lotId, version: saved.version }
        }, { timeout: 30000 })
      } catch (error) { if (key) await storage.remove(key).catch(() => {}); throw error }
    },
  }
}
