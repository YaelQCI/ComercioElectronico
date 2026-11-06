import { InventoryError } from './fefo.js'

export function adjustmentLimits(lot) {
  if (!lot || !Number.isInteger(lot.onHandQty) || !Number.isInteger(lot.reservedQty) || lot.onHandQty < 0 || lot.reservedQty < 0 || lot.reservedQty > lot.onHandQty || lot.onHandQty > 2147483647) throw new InventoryError('INSUFFICIENT_UNRESERVED_STOCK', 'No se pudieron comprobar las existencias del lote. Actualiza el inventario antes de ajustar.')
  return { removableQty: lot.onHandQty - lot.reservedQty, minimumDelta: lot.reservedQty - lot.onHandQty, maximumDelta: 2147483647 - lot.onHandQty }
}

export function validateInventoryAdjustment(lot, delta) {
  if (!Number.isInteger(delta) || !delta || Math.abs(delta) > 2147483647) throw new InventoryError('INVALID_ADJUSTMENT', 'Cantidad del ajuste: escribe un entero distinto de cero; positivo para agregar y negativo para retirar piezas.')
  const limits = adjustmentLimits(lot)
  if (delta < limits.minimumDelta) throw new InventoryError('INSUFFICIENT_UNRESERVED_STOCK', `Solo puedes retirar ${limits.removableQty} ${limits.removableQty === 1 ? 'pieza' : 'piezas'} de este lote: hay ${lot.onHandQty} en existencias y ${lot.reservedQty} reservadas. Actualiza las existencias si estos valores cambiaron.`)
  if (delta > limits.maximumDelta) throw new InventoryError('INSUFFICIENT_UNRESERVED_STOCK', `Solo puedes agregar ${limits.maximumDelta} ${limits.maximumDelta === 1 ? 'pieza' : 'piezas'} a este lote sin superar el máximo de existencias permitido.`)
  return limits
}
