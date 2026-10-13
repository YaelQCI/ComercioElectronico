import { bundlePricing } from '../pricing/prices.js'
import { availableFromLots } from '../inventory/availability.js'

export function bundleSummary(bundle, now = new Date()) {
  const components = bundle.components
  if (!components?.length || bundle.deletedAt || components.some(c => !c.valid)) return null
  let pricing
  try { pricing = bundlePricing(bundle.priceCents, components.map(c => ({ id: c.variantId, quantity: c.quantity, unitPriceCents: c.unitPriceCents }))) } catch { return null }
  const allocated = new Map(pricing.components.map(c => [c.id, c.cents]))
  let servings = 0n
  const documented = components.every(c => /^\d+(?:\.\d{1,4})?$/.test(c.servings ?? '') && Number(c.servings) > 0)
  if (documented) for (const c of components) { const [whole, fraction = ''] = c.servings.split('.'); servings += BigInt(whole + fraction.padEnd(4, '0')) * BigInt(c.quantity) }
  const servingsLabel = documented ? `${servings / 10000n}.${(servings % 10000n).toString().padStart(4, '0')}`.replace(/\.?0+$/, '') : null
  return { id: bundle.id, code: bundle.code, name: bundle.name, description: bundle.description, compositionVersion: bundle.compositionVersion, ...pricing, servings: servingsLabel, availableQty: Math.min(...components.map(c => Math.floor(availableFromLots(c.lots, now) / c.quantity))), components: components.map(({ lots, valid, ...c }) => ({ ...c, allocatedPriceCents: allocated.get(c.variantId) })) }
}
