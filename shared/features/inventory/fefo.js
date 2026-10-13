import { sellableLots } from './lots.js'
export class InventoryError extends Error {
  constructor(code, message) { super(message); this.code = code }
}
export function aggregateUnitDemand(units) {
  const ids = new Set(), demand = new Map()
  for (const unit of units) {
    if (!unit?.id || !unit.variantId || ids.has(unit.id)) throw new InventoryError('INVALID_DEMAND', 'Unidades de pedido inválidas.')
    ids.add(unit.id)
    demand.set(unit.variantId, (demand.get(unit.variantId) ?? 0) + 1)
  }
  return [...demand].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([variantId, quantity]) => ({ variantId, quantity }))
}
export function planFEFO(quantity, lots, now) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new InventoryError('INVALID_QUANTITY', 'Cantidad inválida.')
  let remaining = quantity
  const allocations = []
  for (const lot of sellableLots(lots, now)) {
    const allocated = Math.min(remaining, lot.onHandQty - lot.reservedQty)
    allocations.push({ lot, quantity: allocated }); remaining -= allocated
    if (!remaining) return allocations
  }
  throw new InventoryError('INSUFFICIENT_STOCK', 'No hay suficientes piezas disponibles.')
}
