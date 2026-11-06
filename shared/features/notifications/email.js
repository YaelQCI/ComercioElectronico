export function emailFormatError(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Escribe tu correo electrónico.'
  if (value.length > 254) return 'El correo electrónico no puede superar los 254 caracteres.'
  const parts = value.trim().split('@'), local = parts[0], domain = parts[1]
  const invalid = 'El correo electrónico no tiene un formato válido. Usa un formato como nombre@dominio.com.'
  if (parts.length !== 2 || !local || !domain || !/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return invalid
  const labels = domain.split('.')
  if (labels.length < 2 || !/^[A-Za-z]{2,63}$/.test(labels.at(-1)) || labels.some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return invalid
  return ''
}
export function normalizeEmail(value) {
  const error = emailFormatError(value)
  if (error) throw new RangeError(error)
  return value.trim().toLowerCase()
}
