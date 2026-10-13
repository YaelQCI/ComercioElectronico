import { localDate } from './availability.js'
export function sellableLots(lots, now = new Date()) {
  return lots.filter(lot => !lot.isBlocked && lot.onHandQty > lot.reservedQty && (lot.expiresOn == null || new Date(lot.expiresOn).toISOString().slice(0, 10) >= localDate(now, lot.warehouse.timezone))).sort((a, b) => {
    const left = a.expiresOn == null ? '9999-12-31' : new Date(a.expiresOn).toISOString().slice(0, 10)
    const right = b.expiresOn == null ? '9999-12-31' : new Date(b.expiresOn).toISOString().slice(0, 10)
    return left < right ? -1 : left > right ? 1 : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
export function expiryLabel(lot) {
  if (!lot.expiresOn) return 'Sin caducidad registrada'
  const date = new Date(lot.expiresOn).toISOString().slice(0, 10)
  return lot.expiryPrecision === 'MONTH' ? `${date.slice(5, 7)}/${date.slice(0, 4)}` : `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
}
