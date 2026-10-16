import { stockChangeNotice } from './stock-feedback.js'
const key = 'fitness-cart-observed-v1'
export function observeCart(cart) {
  if (!import.meta.client || !cart) return []
  try {
    const raw = localStorage.getItem(key)
    const previous = raw && raw.length < 100000 ? JSON.parse(raw) : []
    const valid = Array.isArray(previous) ? previous.filter(l => l && typeof l.id === 'string' && /^\d{1,20}$/.test(l.price ?? '') && Number.isSafeInteger(l.available) && l.available >= 0) : []
    const changes = []
    for (const line of cart.lines) {
      const old = valid.find(l => l.id === line.id)
      if (!old) continue
      if (old.price !== line.unitPriceCents) changes.push(`El precio de ${line.name} cambió; mostramos el importe vigente.`)
      if (old.available > line.availableQty || !line.valid) changes.push(stockChangeNotice(line))
    }
    if (cart.lines.length <= 1000) localStorage.setItem(key, JSON.stringify(cart.lines.map(l => ({ id: l.id, price: l.unitPriceCents, available: l.availableQty }))))
    return changes
  } catch { return [] }
}
