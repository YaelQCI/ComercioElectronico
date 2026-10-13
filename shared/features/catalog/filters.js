import { searchQuery } from './search.js'
import { money, servingRatio } from '../pricing/prices.js'

export const filterKeys = ['categoria', 'objetivo', 'disciplina', 'stock', 'porcion', 'presentacion', 'precioMin', 'precioMax']
function values(raw, name, pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/) {
  if (raw == null || raw === '') return []
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  if (!list.length || list.length > 30 || list.some(v => typeof v !== 'string' || v.length > 150 || !pattern.test(v))) throw new RangeError(`Filtro inválido: ${name}`)
  return [...new Set(list)]
}
function mxn(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(value)) throw new RangeError('Rango de precio inválido.')
  const [whole, decimals = ''] = value.split('.')
  return (BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'))).toString()
}
export function parseCatalogFilters(raw) {
  const min = mxn(raw.precioMin), max = mxn(raw.precioMax)
  if (min != null && max != null && BigInt(min) > BigInt(max)) throw new RangeError('Precio mínimo mayor al máximo.')
  const stock = values(raw.stock, 'stock'), porcion = values(raw.porcion, 'porcion')
  if (stock.some(v => !['disponible', 'agotado'].includes(v)) || porcion.some(v => !['menos-15', '15-30', 'mas-30'].includes(v))) throw new RangeError('Estado o rango por porción inválido.')
  return { q: searchQuery(raw.q), categories: values(raw.categoria, 'categoria'), goals: values(raw.objetivo, 'objetivo'), disciplines: values(raw.disciplina, 'disciplina'), presentations: values(raw.presentacion, 'presentacion', /^[^\u0000-\u001f,]+$/), stock, perServing: porcion, minPriceCents: min, maxPriceCents: max }
}
export function filterProducts(products, filters) {
  const matches = (selected, actual) => !selected.length || selected.some(value => actual.includes(value))
  return products.flatMap(product => {
    if (!matches(filters.categories, product.categories.map(c => c.slug)) || !matches(filters.goals, product.facets.filter(f => f.kind === 'GOAL').map(f => f.slug)) || !matches(filters.disciplines, product.facets.filter(f => f.kind === 'DISCIPLINE').map(f => f.slug))) return []
    // Variant-specific groups must all match the SAME presentation.
    const variants = product.variants.filter(variant => {
      const price = money(variant.priceCents)
      if (filters.minPriceCents != null && price < BigInt(filters.minPriceCents) || filters.maxPriceCents != null && price > BigInt(filters.maxPriceCents)) return false
      if (!matches(filters.presentations, [variant.presentationLabel])) return false
      if (filters.stock.length && !filters.stock.includes(variant.availableQty > 0 ? 'disponible' : 'agotado')) return false
      if (filters.perServing.length) {
        const ratio = servingRatio(price, variant.servings)
        if (!ratio) return false
        const bucket = ratio.numerator < 1500n * ratio.denominator ? 'menos-15' : ratio.numerator > 3000n * ratio.denominator ? 'mas-30' : '15-30'
        if (!filters.perServing.includes(bucket)) return false
      }
      return true
    })
    return variants.length ? [{ ...product, variants }] : []
  })
}
export function catalogFilterOptions(products) {
  const categories = new Map(), goals = new Map(), disciplines = new Map(), presentations = new Set()
  for (const product of products) {
    product.categories.forEach(c => categories.set(c.slug, { value: c.slug, label: c.name }))
    product.facets.forEach(f => (f.kind === 'GOAL' ? goals : disciplines).set(f.slug, { value: f.slug, label: f.name }))
    product.variants.forEach(v => presentations.add(v.presentationLabel))
  }
  const sorted = map => [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'es-MX'))
  return { categoria: sorted(categories), objetivo: sorted(goals), disciplina: sorted(disciplines), presentacion: [...presentations].sort().map(value => ({ value, label: value })) }
}
