export function money(value) {
  if (typeof value === 'bigint' && value >= 0n) return value
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) && value.length <= 20) return BigInt(value)
  if (Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  throw new RangeError('El dinero debe ser un entero no negativo de centavos.')
}
export function roundRatio(numerator, denominator) {
  if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint' || numerator < 0n || denominator <= 0n) throw new RangeError('Razón inválida.')
  return (numerator * 2n + denominator) / (denominator * 2n)
}
export function formatMXN(value) {
  const amount = money(value)
  const whole = (amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${whole}.${(amount % 100n).toString().padStart(2, '0')} MXN`
}
function portions(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(value)) throw new RangeError('Porciones inválidas.')
  const [whole, decimal = ''] = value.split('.')
  const scale = 10n ** BigInt(decimal.length), units = BigInt(whole) * scale + BigInt(decimal || '0')
  if (!units) throw new RangeError('Las porciones deben ser positivas.')
  return { units, scale }
}
export function servingRatio(priceCents, servings) {
  if (servings == null) return null
  const { units, scale } = portions(String(servings))
  return { numerator: money(priceCents) * scale, denominator: units }
}
export function variantPricing(variant) {
  const price = money(variant.priceCents)
  const previous = variant.compareAtPriceCents == null ? null : money(variant.compareAtPriceCents)
  const compare = previous != null && previous > price ? previous : null
  const ratio = servingRatio(price, variant.servings)
  const servingCostCents = ratio ? roundRatio(ratio.numerator, ratio.denominator) : null
  return { priceCents: price.toString(), priceLabel: formatMXN(price), compareAtPriceCents: compare?.toString() ?? null, compareAtPriceLabel: compare == null ? null : formatMXN(compare), listSavingCents: (compare == null ? 0n : compare - price).toString(), servingCostCents: servingCostCents?.toString() ?? null, servingCostLabel: servingCostCents == null ? null : `${formatMXN(servingCostCents)} / porción` }
}
export function comparePresentations(variants) {
  const ratios = variants.map(v => servingRatio(v.priceCents, v.servings))
  let best = null
  ratios.forEach((r, index) => {
    if (r && (best == null || r.numerator * ratios[best].denominator < ratios[best].numerator * r.denominator)) best = index
  })
  return variants.map((variant, index) => {
    const r = ratios[index], b = best == null ? null : ratios[best]
    const isBest = !!r && !!b && r.numerator * b.denominator === b.numerator * r.denominator
    // Compare exact rational costs; round only the displayed saving per portion.
    const saving = r && b ? roundRatio(r.numerator * b.denominator - b.numerator * r.denominator, r.denominator * b.denominator) : null
    return { ...variantPricing(variant), id: variant.id, presentationLabel: variant.presentationLabel, flavor: variant.flavor, servings: variant.servings, isBest, savingPerServingCents: saving?.toString() ?? null }
  })
}
export function allocateCents(totalCents, weights) {
  const total = money(totalCents)
  if (!Array.isArray(weights) || !weights.length) throw new RangeError('Faltan componentes.')
  const ids = new Set()
  const rows = weights.map(w => {
    if (typeof w.id !== 'string' || !w.id || ids.has(w.id)) throw new RangeError('Identificador de reparto inválido o duplicado.')
    ids.add(w.id)
    return { id: w.id, weight: money(w.weightCents) }
  })
  const sum = rows.reduce((s, r) => s + r.weight, 0n)
  if (!sum) {
    if (total) throw new RangeError('No se puede repartir dinero sin precios de referencia.')
    return rows.map(r => ({ id: r.id, cents: '0' }))
  }
  const allocations = rows.map(r => ({ ...r, value: total * r.weight / sum, remainder: total * r.weight % sum }))
  let pending = total - allocations.reduce((s, r) => s + r.value, 0n)
  const priority = [...allocations].sort((a, b) => a.remainder === b.remainder ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.remainder > b.remainder ? -1 : 1)
  for (const row of priority) { if (!pending) break; row.value++; pending-- }
  return allocations.map(r => ({ id: r.id, cents: r.value.toString() }))
}
export function bundlePricing(bundlePriceCents, components) {
  const weights = components.map(c => {
    if (!Number.isSafeInteger(c.quantity) || c.quantity < 1) throw new RangeError('Cantidad inválida.')
    return { id: c.id, weightCents: (money(c.unitPriceCents) * BigInt(c.quantity)).toString() }
  })
  const reference = weights.reduce((sum, c) => sum + money(c.weightCents), 0n)
  const price = money(bundlePriceCents)
  return { priceCents: price.toString(), referenceCents: reference.toString(), savingCents: (reference > price ? reference - price : 0n).toString(), components: allocateCents(price, weights) }
}

export function calculateCart({ lines, coupon = null, requestedPointsTenths = '0', availablePointsTenths = '0', shippingQuotedCents }) {
  if (!Array.isArray(lines) || !lines.length) throw new RangeError('El carrito está vacío.')
  const ids = new Set()
  const items = lines.map(line => {
    if (typeof line.id !== 'string' || !line.id || ids.has(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new RangeError('Renglón de carrito inválido.')
    ids.add(line.id)
    const unit = money(line.unitPriceCents), compare = line.compareAtPriceCents == null ? unit : money(line.compareAtPriceCents)
    const base = unit * BigInt(line.quantity)
    const eligibleBase = line.eligibleAmountCents != null ? money(line.eligibleAmountCents) : line.couponEligible === true ? base : 0n
    if (eligibleBase > base) throw new RangeError('Importe elegible superior al renglón.')
    return { id: line.id, base, saving: (compare > unit ? compare - unit : 0n) * BigInt(line.quantity), eligibleBase }
  })
  const subtotal = items.reduce((s, i) => s + i.base, 0n)
  const eligible = items.filter(i => i.eligibleBase > 0n)
  const eligibleTotal = eligible.reduce((s, i) => s + i.eligibleBase, 0n)
  let discount = 0n
  if (coupon) {
    if (coupon.kind === 'FIXED') discount = money(coupon.amountCents)
    else if (coupon.kind === 'PERCENT' && Number.isInteger(coupon.basisPoints) && coupon.basisPoints > 0 && coupon.basisPoints <= 10000) discount = roundRatio(eligibleTotal * BigInt(coupon.basisPoints), 10000n)
    else throw new RangeError('Cupón inválido.')
    if (discount > eligibleTotal) discount = eligibleTotal
  }
  const couponAllocation = new Map(discount ? allocateCents(discount, eligible.map(i => ({ id: i.id, weightCents: i.eligibleBase.toString() }))).map(i => [i.id, money(i.cents)]) : [])
  const afterCoupon = subtotal - discount
  const requested = money(requestedPointsTenths), available = money(availablePointsTenths)
  if (requested > available || requested > afterCoupon) throw new RangeError('Canje de puntos superior al saldo o al importe de productos.')
  const pointsAllocation = new Map(allocateCents(requested, items.map(i => ({ id: i.id, weightCents: (i.base - (couponAllocation.get(i.id) ?? 0n)).toString() }))).map(i => [i.id, money(i.cents)]))
  const quote = money(shippingQuotedCents), shipping = afterCoupon >= 149900n ? 0n : quote
  const goodsMoney = afterCoupon - requested
  return {
    goodsBeforeCouponCents: subtotal.toString(), listSavingCents: items.reduce((s, i) => s + i.saving, 0n).toString(), couponDiscountCents: discount.toString(), goodsAfterCouponCents: afterCoupon.toString(), pointsAppliedTenths: requested.toString(), goodsMoneyCents: goodsMoney.toString(), shippingQuotedCents: quote.toString(), shippingChargedCents: shipping.toString(), shippingSubsidyCents: (quote - shipping).toString(), totalMoneyCents: (goodsMoney + shipping).toString(),
    lines: items.map(i => ({ id: i.id, baseCents: i.base.toString(), couponCents: (couponAllocation.get(i.id) ?? 0n).toString(), pointsTenths: (pointsAllocation.get(i.id) ?? 0n).toString(), moneyCents: (i.base - (couponAllocation.get(i.id) ?? 0n) - (pointsAllocation.get(i.id) ?? 0n)).toString() })),
  }
}
