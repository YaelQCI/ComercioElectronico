import { money, servingRatio } from '../pricing/prices.js'
import { foldSearch } from './search.js'
export const catalogOrders = [
  { value: 'relevancia', label: 'Relevancia' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'porcion-asc', label: 'Costo por porción: menor a mayor' },
  { value: 'porcion-desc', label: 'Costo por porción: mayor a menor' },
  { value: 'novedades', label: 'Novedades' },
]
export function parseCatalogPage(raw) {
  const order = raw.orden ?? 'relevancia'
  if (typeof order !== 'string' || !catalogOrders.some(o => o.value === order)) throw new RangeError('Orden inválido.')
  const page = typeof raw.pagina === 'string' && /^[1-9]\d{0,6}$/.test(raw.pagina) ? Number(raw.pagina) : 1
  return { order, page }
}
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0
function minimumPrice(product) { return product.variants.reduce((min, v) => { const price = money(v.priceCents); return min == null || price < min ? price : min }, null) }
function minimumServing(product) {
  return product.variants.map(v => servingRatio(v.priceCents, v.servings)).filter(Boolean).reduce((min, r) => !min || r.numerator * min.denominator < min.numerator * r.denominator ? r : min, null)
}
function relevance(product, q) {
  if (!q) return product.featuredPosition == null ? 0 : Math.max(1, 10000 - product.featuredPosition)
  const name = foldSearch(product.name)
  if (product.variants.some(v => foldSearch(v.sku) === q)) return 1000
  if (name === q) return 900
  if (name.startsWith(q)) return 800
  if (name.includes(q)) return 700
  if (product.categories.some(c => foldSearch(c.name).includes(q))) return 600
  return 0
}
export function sortCatalog(products, order, q = '') {
  const normalized = foldSearch(q)
  const decorated = products.map(product => ({ product, price: minimumPrice(product), serving: minimumServing(product), score: relevance(product, normalized) }))
  return decorated.sort((a, b) => {
    let difference = 0
    if (order.startsWith('precio')) difference = cmp(a.price, b.price) * (order.endsWith('desc') ? -1 : 1)
    else if (order.startsWith('porcion')) {
      if (!a.serving || !b.serving) difference = !a.serving && !b.serving ? 0 : a.serving ? -1 : 1
      else difference = cmp(a.serving.numerator * b.serving.denominator, b.serving.numerator * a.serving.denominator) * (order.endsWith('desc') ? -1 : 1)
    } else if (order === 'novedades') difference = cmp(b.product.publishedAt ?? '', a.product.publishedAt ?? '')
    else difference = cmp(b.score, a.score)
    return difference || cmp(a.product.id, b.product.id)
  }).map(row => row.product)
}
export function paginateCatalog(products, { order = 'relevancia', page = 1, q = '' } = {}) {
  const sorted = sortCatalog(products, order, q), total = sorted.length, pageSize = 12, pages = Math.ceil(total / pageSize)
  const current = Math.max(1, Math.min(Number.isSafeInteger(page) ? page : 1, pages || 1))
  const startIndex = (current - 1) * pageSize
  return { products: sorted.slice(startIndex, startIndex + pageSize), total, pages, page: current, pageSize, start: total ? startIndex + 1 : 0, end: Math.min(startIndex + pageSize, total), order }
}
