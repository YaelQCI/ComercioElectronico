export function searchQuery(value) {
  if (value == null) return ''
  if (typeof value !== 'string' || value.length > 120 || /[\u0000-\u001f]/.test(value)) throw new RangeError('Consulta inválida: máximo 120 caracteres.')
  return value.trim().replace(/\s+/g, ' ')
}
export function foldSearch(value) { return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('es-MX') }
export function searchPattern(value) { return `%${foldSearch(searchQuery(value)).replace(/[\\%_]/g, char => `\\${char}`)}%` }
