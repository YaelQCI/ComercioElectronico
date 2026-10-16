export function lotTraceability(input) {
  const result = {}
  for (const field of ['origin', 'customsEntry']) {
    const value = input?.[field]
    if (value == null || value === '') result[field] = null
    else {
      if (typeof value !== 'string' || value.trim().length > 500 || /[\u0000-\u001f\u007f]/.test(value)) throw new RangeError('Origen o aduana inválidos; máximo 500 caracteres.')
      result[field] = value.trim() || null
    }
  }
  const date = input?.importedOn
  if (date == null || date === '') result.importedOn = null
  else {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Fecha de importación inválida.')
    const parsed = new Date(`${date}T00:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new RangeError('Fecha de importación inválida.')
    result.importedOn = date
  }
  return result
}
