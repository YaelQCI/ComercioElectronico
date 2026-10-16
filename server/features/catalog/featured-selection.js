export function featuredPosition(value) {
  if (value === null) return null
  if (!Number.isInteger(value) || value < 1 || value > 1000) throw new RangeError('La prioridad de inicio debe ser un número entero entre 1 y 1000, o quedar vacía para quitar el producto de la selección.')
  return value
}
