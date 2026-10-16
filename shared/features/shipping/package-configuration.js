export const packageMeasurements = [
  { key: 'innerLengthMm', label: 'Largo interior (mm)' },
  { key: 'innerWidthMm', label: 'Ancho interior (mm)' },
  { key: 'innerHeightMm', label: 'Alto interior (mm)' },
  { key: 'outerLengthMm', label: 'Largo exterior (mm)' },
  { key: 'outerWidthMm', label: 'Ancho exterior (mm)' },
  { key: 'outerHeightMm', label: 'Alto exterior (mm)' },
  { key: 'tareWeightGrams', label: 'Peso de la caja vacía (g)', min: 0 },
  { key: 'maxGrossWeightGrams', label: 'Peso bruto máximo (g, opcional)', optional: true },
]
export function packageConfiguration(input) {
  const code = typeof input?.code === 'string' ? input.code.trim().toUpperCase() : ''
  if (!/^[A-Z0-9][A-Z0-9._-]{0,59}$/.test(code)) throw new Error('Usa un código de hasta 60 letras, números, puntos, guiones o guiones bajos.')
  if (typeof input.isActive !== 'boolean') throw new Error('Selecciona la disponibilidad de la caja.')
  const data = { code, isActive: input.isActive }
  for (const field of packageMeasurements) {
    const value = input[field.key]
    if (field.optional && value === null) { data[field.key] = null; continue }
    if (!Number.isInteger(value) || value < (field.min ?? 1) || value > 2147483647) throw new Error(`${field.label}: introduce un entero válido.`)
    data[field.key] = value
  }
  for (const axis of ['Length', 'Width', 'Height']) if (data[`outer${axis}Mm`] < data[`inner${axis}Mm`]) throw new Error('Las medidas exteriores deben ser mayores o iguales que las interiores.')
  if (data.maxGrossWeightGrams !== null && data.maxGrossWeightGrams <= data.tareWeightGrams) throw new Error('El peso bruto máximo debe superar el peso de la caja vacía.')
  return data
}
