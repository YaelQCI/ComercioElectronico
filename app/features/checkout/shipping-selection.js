export function hasCurrentShippingQuote(quote, cartVersion, now = Date.now()) {
  if (!quote?.id || quote.cartVersion !== cartVersion) return false
  const quotedAt = Date.parse(quote.quotedAt)
  if (!Number.isFinite(quotedAt) || quotedAt > now || now - quotedAt > 600000) return false
  if (quote.expiresAt != null) {
    const expiresAt = Date.parse(quote.expiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return false
  }
  return true
}
