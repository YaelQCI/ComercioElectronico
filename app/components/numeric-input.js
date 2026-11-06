function format(control) {
  if (control.type === 'tel') return { phone: true }
  if (control.type !== 'number' && !['numeric', 'decimal'].includes(control.inputMode)) return null
  const integer = control.inputMode === 'numeric' || (control.type === 'number' && control.step !== 'any' && Number.isInteger(Number(control.step || '1')))
  return { integer, negative: Number(control.min) < 0, comma: control.type !== 'number' }
}

function instruction(options) {
  if (options.phone) return 'usa dígitos, espacios, guiones, puntos o paréntesis y un + solo al inicio; no uses letras.'
  if (options.integer) return options.negative ? 'usa solo dígitos y un signo menos al principio para retirar piezas; no uses letras ni decimales.' : 'usa solo dígitos del 0 al 9, sin letras, signos ni decimales.'
  return `usa solo dígitos y ${options.comma ? 'un punto o una coma decimal' : 'un punto decimal'}; no uses letras, notación científica ni separadores de miles.`
}

export function numericValueError(control, value = control.value) {
  const options = format(control)
  if (!options || value == null || value === '') return ''
  if (options.phone) {
    if (!/^\+?[0-9 ().-]+$/.test(String(value).trim()) || !/[0-9]/.test(value)) return instruction(options)
    return String(value).trim().length > 25 ? 'usa como máximo 25 caracteres.' : ''
  }
  const sign = options.negative ? '-?' : ''
  const decimals = options.integer ? '' : options.comma ? '(?:[.,][0-9]+)?' : '(?:[.][0-9]+)?'
  if (!new RegExp(`^${sign}[0-9]+${decimals}$`).test(String(value))) return instruction(options)
  return ''
}

// Rechaza la inserción completa: nunca transforma «12abc» en «12» ni cambia un importe.
// Sigue siendo necesario validar al enviar y en el servidor (scripts pueden omitir eventos).
export function guardNumericEntry(event) {
  if (event.defaultPrevented || event.isComposing || !event.target) return ''
  const control = event.target, options = format(control)
  if (!options) return ''
  const paste = event.type === 'paste'
  const text = paste ? event.clipboardData?.getData('text/plain') : event.data
  if (typeof text !== 'string' || !text || (!paste && !event.inputType?.startsWith('insert'))) return ''
  const allowed = options.phone ? /^[0-9+ ().-]+$/ : new RegExp(`^[0-9${options.integer ? '' : options.comma ? '.,' : '.'}${options.negative ? '-' : ''}]+$`)
  let invalid = !allowed.test(text) || (paste && !!numericValueError(control, text))
  if (!invalid && typeof control.selectionStart === 'number') {
    const candidate = control.value.slice(0, control.selectionStart) + text + control.value.slice(control.selectionEnd)
    const partial = options.phone ? /^\+?[0-9 ().-]*$/ : new RegExp(`^${options.negative ? '-?' : ''}[0-9]*${options.integer ? '' : options.comma ? '(?:[.,][0-9]*)?' : '(?:[.][0-9]*)?'}$`)
    invalid = !partial.test(candidate)
  }
  if (!invalid) return ''
  event.preventDefault()
  return instruction(options)
}
