const transactionScope = Symbol('inventory-transaction')
export function withInventoryTransaction(database, callback) {
  return database.$transaction(tx => callback(Object.freeze({ tx, [transactionScope]: true })), { timeout: 30000 })
}
export function inventoryTransaction(context) {
  if (!context?.[transactionScope]) throw new Error('Inventario requiere withInventoryTransaction para coordinar todos los recursos.')
  return context.tx
}
