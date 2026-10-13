import { aggregateUnitDemand, planFEFO, InventoryError } from '../../../shared/features/inventory/fefo.js'
import { sellableLots } from '../../../shared/features/inventory/lots.js'
import { inventoryTransaction } from './inventory-transaction.js'

async function databaseNow(tx) { return (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now }
async function lockReservation(tx, id) {
  const initial = await tx.reservationSet.findUnique({ where: { id } })
  if (!initial) throw new InventoryError('NOT_FOUND', 'Reserva no disponible.')
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${initial.orderId}::uuid FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "ReservationSet" WHERE id = ${id}::uuid FOR UPDATE`
  const reservation = await tx.reservationSet.findUnique({ where: { id }, include: { order: true, reservationStock_reservationSet: true, paymentAttempt_reservationSet: true } })
  return reservation
}
async function lockInventory(tx, variantIds, requireActive = true) {
  // Global lock order: order/reservation → sorted products → variants → lots.
  // Sorting only variant IDs is insufficient when combos touch multiple products.
  await tx.$queryRaw`
    SELECT id FROM "Product" WHERE id IN (
      SELECT "productId" FROM "ProductVariant" WHERE id = ANY(${variantIds}::uuid[])
    ) ORDER BY id FOR UPDATE
  `
  const variants = await tx.$queryRaw`
    SELECT v.id FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
    LEFT JOIN "Brand" b ON b.id = p."brandId"
    WHERE v.id = ANY(${variantIds}::uuid[]) AND (NOT ${requireActive} OR (v."deletedAt" IS NULL AND p."deletedAt" IS NULL
      AND p."publishedAt" <= clock_timestamp() AND (p."brandId" IS NULL OR b."isActive")))
    ORDER BY v.id FOR UPDATE OF v
  `
  if (variants.length !== variantIds.length) throw new InventoryError('PRODUCT_UNAVAILABLE', 'Presentación no disponible.')
  await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE "variantId" = ANY(${variantIds}::uuid[]) ORDER BY "variantId", "expiresOn" NULLS LAST, "createdAt", id FOR UPDATE`
  return tx.inventoryLot.findMany({ where: { variantId: { in: variantIds } }, include: { warehouse: { select: { timezone: true } } } })
}
function lotSnapshot(lot) {
  return { id: lot.id, lotCode: lot.lotCode, expiresOn: lot.expiresOn?.toISOString().slice(0, 10) ?? null, expiryPrecision: lot.expiryPrecision, importedOn: lot.importedOn?.toISOString().slice(0, 10) ?? null, customsEntry: lot.customsEntry, origin: lot.origin, certificateAssetId: lot.certificateAssetId }
}
export async function reserveInventory(context, reservationId) {
  const tx = inventoryTransaction(context)
  const reservation = await lockReservation(tx, reservationId), now = await databaseNow(tx)
  if (reservation.state !== 'ACTIVE' || reservation.expiresAt <= now || reservation.order.status !== 'PENDING_PAYMENT') throw new InventoryError('RESERVATION_UNAVAILABLE', 'Reserva vencida o no disponible.')
  const units = await tx.orderUnit.findMany({ where: { orderId: reservation.orderId }, orderBy: [{ variantId: 'asc' }, { orderComponentId: 'asc' }, { unitOrdinal: 'asc' }] })
  if (!units.length) throw new InventoryError('INVALID_DEMAND', 'El pedido no contiene unidades.')
  if (reservation.reservationStock_reservationSet.length) {
    const movements = await tx.inventoryMovement.findMany({ where: { reservationStock: { reservationSetId: reservationId } } })
    const stocks = reservation.reservationStock_reservationSet
    if (movements.some(m => m.kind !== 'RESERVE') || movements.length !== stocks.length || stocks.reduce((sum, s) => sum + s.quantity, 0) !== units.length || stocks.some(s => units.filter(u => u.lotId === s.lotId).length !== s.quantity || !movements.some(m => m.reservationStockId === s.id && m.reservedDelta === s.quantity))) throw new InventoryError('RESERVATION_INCONSISTENT', 'Reserva de inventario inconsistente.')
    const lots = await lockInventory(tx, aggregateUnitDemand(units).map(d => d.variantId))
    const lockedNow = await databaseNow(tx)
    if (reservation.expiresAt <= lockedNow || stocks.some(s => !sellableLots(lots.filter(l => l.id === s.lotId).map(l => ({ ...l, reservedQty: 0 })), lockedNow).length)) throw new InventoryError('RESERVATION_UNAVAILABLE', 'Reserva o lote ya no disponible.')
    return reservation.reservationStock_reservationSet
  }
  const results = []
  const demands = aggregateUnitDemand(units)
  const lockedLots = await lockInventory(tx, demands.map(d => d.variantId))
  for (const demand of demands) {
    const lots = lockedLots.filter(lot => lot.variantId === demand.variantId)
    const allocations = planFEFO(demand.quantity, lots, await databaseNow(tx))
    const variantUnits = units.filter(u => u.variantId === demand.variantId)
    let cursor = 0
    for (const allocation of allocations) {
      const stock = await tx.reservationStock.create({ data: { reservationSetId: reservationId, lotId: allocation.lot.id, quantity: allocation.quantity } })
      await tx.inventoryMovement.create({ data: { lotId: stock.lotId, reservationStockId: stock.id, kind: 'RESERVE', reservedDelta: stock.quantity, actorType: 'SYSTEM', reason: 'Reserva FEFO al iniciar pago', idempotencyKey: `reserve:${stock.id}` } })
      for (let index = 0; index < stock.quantity; index++) {
        await tx.orderUnit.update({ where: { id: variantUnits[cursor++].id }, data: { lotId: stock.lotId, lotSnapshot: lotSnapshot(allocation.lot) } })
      }
      results.push(stock)
    }
  }
  if (reservation.expiresAt <= await databaseNow(tx)) throw new InventoryError('RESERVATION_EXPIRED', 'La reserva venció antes de completarse.')
  return results
}
export async function consumeInventory(context, reservationId) {
  const tx = inventoryTransaction(context)
  const reservation = await lockReservation(tx, reservationId)
  if (reservation.state === 'CONSUMED') return { alreadyConsumed: true }
  if (!['ACTIVE', 'RECONCILING'].includes(reservation.state)) throw new InventoryError('RESERVATION_UNAVAILABLE', 'Reserva no disponible.')
  const now = await databaseNow(tx)
  if (reservation.order.totalMoneyCents === 0n) {
    if (reservation.paymentAttempt_reservationSet.length) throw new InventoryError('PAYMENT_RECONCILIATION_REQUIRED', 'Un pedido de total cero no debe tener intentos Stripe.')
    if (reservation.expiresAt <= now) throw new InventoryError('RESERVATION_EXPIRED', 'Reserva vencida.')
  } else if (!reservation.paymentAttempt_reservationSet.some(p => p.status === 'SUCCEEDED' && p.currency === 'MXN' && p.amountCents === reservation.order.totalMoneyCents && p.providerPaidAt && p.providerPaidAt <= reservation.expiresAt)) throw new InventoryError('PAYMENT_RECONCILIATION_REQUIRED', 'Falta pago válido confirmado por servidor.')
  const units = await tx.orderUnit.findMany({ where: { orderId: reservation.orderId }, orderBy: { id: 'asc' } })
  const stocks = reservation.reservationStock_reservationSet
  if (!units.length || !stocks.length || stocks.reduce((sum, stock) => sum + stock.quantity, 0) !== units.length || units.some(u => !stocks.some(s => s.lotId === u.lotId))) throw new InventoryError('RESERVATION_INCONSISTENT', 'Reserva sin inventario asignado completo.')
  await lockInventory(tx, aggregateUnitDemand(units).map(d => d.variantId))
  for (const stock of reservation.reservationStock_reservationSet) {
    const lot = await tx.inventoryLot.findUnique({ where: { id: stock.lotId }, include: { warehouse: { select: { timezone: true } } } })
    // Held pieces are temporarily included for the sellability check, never made public as free stock.
    if (!sellableLots([{ ...lot, reservedQty: 0 }], await databaseNow(tx)).length) throw new InventoryError('LOT_UNAVAILABLE', 'Un lote reservado dejó de ser vendible; requiere reconciliación.')
    const assigned = units.filter(u => u.lotId === stock.lotId)
    if (assigned.length !== stock.quantity) throw new InventoryError('RESERVATION_INCONSISTENT', 'Asignación de lotes inconsistente.')
    for (const unit of assigned) {
      await tx.inventoryMovement.create({ data: { lotId: stock.lotId, reservationStockId: stock.id, orderUnitId: unit.id, kind: 'SALE', onHandDelta: -1, reservedDelta: -1, actorType: 'SYSTEM', reason: 'Consumo de reserva confirmado', idempotencyKey: `sale:${unit.id}` } })
    }
  }
  await tx.reservationSet.update({ where: { id: reservationId }, data: { state: 'CONSUMED', resolvedAt: await databaseNow(tx), resolutionReason: 'Inventario consumido; resolución transaccional de todos los recursos' } })
  return { alreadyConsumed: false }
}
export async function releaseInventory(context, reservationId, reason) {
  const tx = inventoryTransaction(context)
  const reservation = await lockReservation(tx, reservationId)
  if (reservation.state === 'RELEASED') return { alreadyReleased: true }
  if (!['ACTIVE', 'RECONCILING'].includes(reservation.state) || typeof reason !== 'string' || !reason.trim()) throw new InventoryError('RESERVATION_UNAVAILABLE', 'Reserva o motivo no disponible.')
  if (reservation.paymentAttempt_reservationSet.some(p => !['FAILED', 'EXPIRED'].includes(p.status) || !p.lastReconciledAt)) throw new InventoryError('PAYMENT_RECONCILIATION_REQUIRED', 'Verificar Stripe antes de liberar inventario.')
  const units = await tx.orderUnit.findMany({ where: { orderId: reservation.orderId } })
  await lockInventory(tx, aggregateUnitDemand(units).map(d => d.variantId), false)
  for (const stock of [...reservation.reservationStock_reservationSet].sort((a, b) => a.lotId < b.lotId ? -1 : 1)) {
    await tx.inventoryMovement.create({ data: { lotId: stock.lotId, reservationStockId: stock.id, kind: 'RELEASE', reservedDelta: -stock.quantity, actorType: 'SYSTEM', reason: reason.trim(), idempotencyKey: `release:${stock.id}` } })
  }
  await tx.reservationSet.update({ where: { id: reservationId }, data: { state: 'RELEASED', resolvedAt: await databaseNow(tx), resolutionReason: reason.trim() } })
  return { alreadyReleased: false }
}
