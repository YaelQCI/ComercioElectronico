export function phoneFormatError(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string' || !/^\+?[0-9 ().-]+$/.test(value.trim()) || !/[0-9]/.test(value)) return 'usa dígitos, espacios, guiones, puntos o paréntesis y, si necesitas la lada internacional, un + al inicio; no uses letras.'
  if (value.trim().length > 25) return 'usa como máximo 25 caracteres.'
  return ''
}
