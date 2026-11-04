export function shippingQuoteDeadline(quote) {
  const quotedAt = Date.parse(quote?.quotedAt)
  const expiresAt = quote?.expiresAt == null ? Infinity : Date.parse(quote.expiresAt)
  if (!Number.isFinite(quotedAt) || Number.isNaN(expiresAt)) return null
  return Math.min(quotedAt + 600001, expiresAt)
}

export function hasCurrentShippingQuote(quote, cartVersion, now = Date.now()) {
  if (!quote?.id || quote.cartVersion !== cartVersion || Date.parse(quote.quotedAt) > now) return false
  const deadline = shippingQuoteDeadline(quote)
  return deadline !== null && now < deadline
}
