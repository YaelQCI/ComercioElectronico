import { InventoryError } from '../../../shared/features/inventory/fefo.js'
import { inventoryTransaction } from './inventory-transaction.js'
export async function adjustInventory(context, { lotId, delta, reason, actorId, idempotencyKey }) {
  const tx = inventoryTransaction(context)
  if (!Number.isInteger(delta) || !delta || Math.abs(delta) > 2147483647 || typeof reason !== 'string' || !reason.trim() || reason.length > 1000 || typeof idempotencyKey !== 'string' || !idempotencyKey) throw new InventoryError('INVALID_ADJUSTMENT', 'Ajuste inválido.')
  const admins = await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actorId}::uuid AND role = 'ADMIN' AND "deletedAt" IS NULL FOR SHARE`
  if (!admins.length) throw new InventoryError('FORBIDDEN', 'Solo un administrador puede ajustar inventario.')
  await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE id = ${lotId}::uuid FOR UPDATE`
  const previous = await tx.inventoryMovement.findUnique({ where: { idempotencyKey } })
  if (previous) {
    if (previous.kind !== 'ADJUSTMENT' || previous.actorId !== actorId || previous.lotId !== lotId || previous.onHandDelta !== delta || previous.reason !== reason.trim()) throw new InventoryError('IDEMPOTENCY_CONFLICT', 'Clave de ajuste usada para otra operación.')
    return previous
  }
  const lot = await tx.inventoryLot.findUnique({ where: { id: lotId } })
  if (!lot || lot.onHandQty + delta < lot.reservedQty || lot.onHandQty + delta > 2147483647) throw new InventoryError('INSUFFICIENT_UNRESERVED_STOCK', 'El ajuste no puede retirar piezas reservadas ni producir saldo inválido.')
  return tx.inventoryMovement.create({ data: { lotId, kind: 'ADJUSTMENT', onHandDelta: delta, reason: reason.trim(), actorId, actorType: 'ADMIN', idempotencyKey } })
}
