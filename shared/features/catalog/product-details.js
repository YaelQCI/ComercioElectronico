export function optionalProductText(value, label, max = 10000) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new RangeError(`${label} inválido.`)
  const text = value.replace(/\r\n?/g, '\n').trim()
  if (text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new RangeError(`${label} inválido.`)
  return text || null
}
export function nutritionData(value) {
  if (value == null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.rows) || value.rows.length > 100) throw new RangeError('Tabla nutrimental inválida; máximo 100 filas.')
  const names = new Set()
  const rows = value.rows.map(row => {
    const name = optionalProductText(row?.name, 'Nutrimento', 120), unit = optionalProductText(row?.unit, 'Unidad', 30)
    if (!name || !unit || /[\n\t]/.test(name + unit) || typeof row?.amount !== 'string' || !/^(0|[1-9]\d{0,9})(\.\d{1,4})?$/.test(row.amount)) throw new RangeError('Cada nutrimento necesita nombre, cantidad no negativa y unidad.')
    const key = name.toLocaleLowerCase('es-MX')
    if (names.has(key)) throw new RangeError('No repitas un nutrimento en la tabla.')
    names.add(key)
    return { name, amount: row.amount, unit }
  })
  if (JSON.stringify(rows).length > 20000) throw new RangeError('La tabla nutrimental es demasiado extensa.')
  return rows.length ? { rows } : null
}
