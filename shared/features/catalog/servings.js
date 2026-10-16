export function parseServings(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(value) || BigInt(value.replace('.', '')) === 0n) {
    throw new RangeError('El número de porciones debe ser positivo, con máximo cuatro decimales. Déjalo vacío si no está documentado.')
  }
  return value
}
