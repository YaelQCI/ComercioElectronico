import { referencePackages } from '../../../shared/features/shipping/reference-packages.js'
export function ensureReferencePackages(db) {
  return db.$transaction(async tx => {
    for (const box of referencePackages) await tx.packageType.upsert({ where: { code: box.code }, create: box, update: {} })
  })
}
