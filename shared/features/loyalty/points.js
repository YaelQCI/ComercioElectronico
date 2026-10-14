const amount = value => { if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) throw new RangeError('Importe inválido.'); return BigInt(value) }
export function earnedTenths(goodsMoneyCents, refundedGoodsMoneyCents = '0') {
  const money = amount(goodsMoneyCents), refunded = amount(refundedGoodsMoneyCents)
  if (refunded > money) throw new RangeError('Reembolso supera importe elegible.')
  return ((money - refunded) / 1000n * 10n).toString()
}
export function availableTenths(balance, reserved) {
  const b = BigInt(balance), r = amount(reserved)
  return (b > r ? b - r : 0n).toString()
}
export function pointsLabel(value) {
  const n = BigInt(value), sign = n < 0n ? '-' : '', absolute = n < 0n ? -n : n
  return `${sign}${absolute / 10n}.${absolute % 10n}`
}
