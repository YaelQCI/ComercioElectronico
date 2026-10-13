export function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(value.trim()) || /\.\./.test(value.trim())) throw new RangeError('Escribe un correo electrónico válido.')
  return value.trim().toLowerCase()
}
