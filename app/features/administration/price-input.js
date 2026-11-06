const maximumCents = 999999999999999n

export function pesosToCents(value, label = 'Precio') {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value).trim())
  if (!match) throw new RangeError(`${label}: escribe un importe en pesos con máximo dos decimales, por ejemplo 150.00.`)
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  if (cents > maximumCents) throw new RangeError(`${label}: el importe supera el máximo permitido de 9999999999999.99 MXN.`)
  return cents.toString()
}

export function centsToPesos(value) {
  if (value == null || value === '') return ''
  const cents = BigInt(value)
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}
