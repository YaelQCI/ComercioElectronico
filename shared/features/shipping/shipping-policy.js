import { money } from '../pricing/prices.js'

export function postalCode(value) {
  if (typeof value !== 'string' || !/^\d{5}$/.test(value)) throw new RangeError('El código postal debe tener cinco dígitos.')
  return value
}
export function shippingProgress(goodsAfterCouponCents, providerAmountCents = null) {
  const goods = money(goodsAfterCouponCents), threshold = 149900n
  const eligible = goods >= threshold
  const quote = providerAmountCents == null ? null : money(providerAmountCents)
  return { thresholdCents: threshold.toString(), baseCents: goods.toString(), eligible, remainingCents: (eligible ? 0n : threshold - goods).toString(), percent: eligible ? 100 : Number(goods * 10000n / threshold) / 100, quotedAmountCents: quote?.toString() ?? null, chargedAmountCents: quote == null ? null : eligible ? '0' : quote.toString(), subsidyCents: quote == null ? null : eligible ? quote.toString() : '0' }
}
