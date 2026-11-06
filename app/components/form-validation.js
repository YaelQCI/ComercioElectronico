// Mensajes de interfaz: las reglas de negocio siguen comprobándose en el servidor.
import { numericValueError } from './numeric-input.js'
export function controlLabel(control) {
  const groupLabel = control.type === 'radio' ? control.closest?.('fieldset')?.querySelector('legend')?.textContent : ''
  return (groupLabel || control.labels?.[0]?.textContent || control.getAttribute?.('aria-label') || control.name || 'Campo')
    .replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim()
}

export function controlError(control) {
  if (!control.willValidate) return ''
  const label = controlLabel(control), v = control.validity, value = String(control.value ?? '')
  const fail = message => `${label}: ${message}`
  if (v.customError) return fail(control.validationMessage)
  if (v.badInput) return fail(['date', 'datetime-local', 'time'].includes(control.type) ? 'selecciona una fecha u hora completas y válidas.' : 'escribe un número válido.')
  if (v.valueMissing || (control.required && !['checkbox', 'radio', 'file'].includes(control.type) && !value.trim())) {
    if (control.type === 'checkbox') return fail('marca esta casilla para continuar.')
    if (control.type === 'radio' || control.tagName === 'SELECT') return fail('selecciona una opción para continuar.')
    if (control.type === 'file') return fail('selecciona el archivo que quieres guardar.')
    return fail(value ? 'no uses solo espacios; escribe un valor.' : 'completa este campo.')
  }
  if (!value) return ''
  if (v.typeMismatch) return fail(control.type === 'email' ? 'escribe un correo válido, por ejemplo nombre@dominio.com.' : 'escribe una URL completa, por ejemplo https://ejemplo.com.')
  if (control.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return fail('escribe un correo con usuario, @ y dominio completo, por ejemplo nombre@dominio.com.')
  if (v.tooShort || (control.minLength > 0 && value.length < control.minLength)) return fail(`escribe al menos ${control.minLength} caracteres.`)
  if (v.tooLong || (control.maxLength > 0 && value.length > control.maxLength)) return fail(`usa como máximo ${control.maxLength} caracteres.`)
  if ((control.type === 'password' || control.getAttribute?.('data-password-field') === 'true') && control.maxLength === 256 && new TextEncoder().encode(value).length > 256) return fail('la contraseña no puede superar 256 bytes; los acentos y emojis pueden ocupar varios bytes. Usa una contraseña más corta.')
  if (v.rangeUnderflow) return fail(`el valor mínimo permitido es ${control.min}.`)
  if (v.rangeOverflow) return fail(`el valor máximo permitido es ${control.max}.`)
  if (v.stepMismatch) return fail(control.step === '1' ? 'escribe un número entero, sin decimales.' : `usa incrementos de ${control.step || '1'} a partir de ${control.min || '0'}.`)
  const numericError = numericValueError(control, value)
  if (numericError) return fail(numericError)
  if (v.patternMismatch) {
    const pattern = control.pattern, explicit = control.getAttribute?.('data-format-error')
    if (explicit) return fail(explicit)
    if (pattern === '[0-9]{5}') return fail('escribe exactamente cinco dígitos, por ejemplo 01000.')
    if (pattern === '[a-z0-9]+(-[a-z0-9]+)*') return fail('usa minúsculas, números y guiones entre palabras; no uses espacios, acentos ni guiones al principio o al final.')
    if (pattern === '[A-Za-z0-9_-]{1,60}') return fail('usa de 1 a 60 letras, números, guiones o guiones bajos, sin espacios.')
    if (pattern === '[0-9]+([.,][0-9]{1,2})?') return fail('escribe un importe sin separadores de miles y con hasta dos decimales, por ejemplo 150.00.')
    if (pattern === '(0|[1-9][0-9]{0,9})([.][0-9]{1,4})?') return fail('usa hasta diez dígitos enteros y cuatro decimales con punto, sin ceros adicionales al principio, por ejemplo 30.5.')
    if (pattern === 'https://.+') return fail('usa un enlace que empiece con https://.')
    return fail(control.title || 'revisa el formato indicado junto al campo.')
  }
  if (!v.valid) return fail('revisa el valor antes de continuar.')
  return ''
}

export function formErrors(form) {
  const radioGroups = new Set()
  return [...form.elements].flatMap(control => {
    const message = controlError(control)
    if (message && control.type === 'radio' && control.name) {
      if (radioGroups.has(control.name)) return []
      radioGroups.add(control.name)
    }
    return message ? [{ control, message }] : []
  })
}
