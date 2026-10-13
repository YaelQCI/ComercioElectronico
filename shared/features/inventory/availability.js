export function localDate(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = type => parts.find(p => p.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}`
}
export function availableFromLots(lots, now = new Date()) {
  return lots.reduce((sum, lot) => {
    if (lot.isBlocked) return sum
    const expiry = lot.expiresOn == null ? null : new Date(lot.expiresOn).toISOString().slice(0, 10)
    if (expiry && expiry < localDate(now, lot.warehouse.timezone)) return sum
    // onHandQty already denotes sellable physical units; nonSellableQty is separate.
    return sum + Math.max(0, lot.onHandQty - lot.reservedQty)
  }, 0)
}
