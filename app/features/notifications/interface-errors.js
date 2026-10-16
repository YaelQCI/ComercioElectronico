function alertText(element) {
  const copy = element.cloneNode(true)
  // Los botones de reintento son acciones, no forman parte del mensaje del error.
  for (const control of copy.querySelectorAll('button, input, select, textarea, script, style, [aria-hidden="true"], [hidden]')) control.remove()
  return copy.textContent.replace(/\s+/g, ' ').trim()
}
function invalidMessage(control) {
  const label = control.labels?.[0]?.textContent.replace(/\s+/g, ' ').trim() || 'Campo'
  const validity = control.validity
  let message = 'Revisa el valor de este campo.'
  if (validity.valueMissing) message = control.type === 'checkbox' ? 'Debes marcar esta casilla para continuar.' : 'Completa este campo.'
  else if (validity.typeMismatch) message = control.type === 'email' ? 'Escribe un correo válido.' : 'Introduce un valor válido.'
  else if (validity.rangeUnderflow) message = `El mínimo permitido es ${control.min}.`
  else if (validity.rangeOverflow) message = `El máximo permitido es ${control.max}.`
  else if (validity.stepMismatch || validity.badInput) message = 'Introduce un número válido con el incremento indicado.'
  else if (validity.patternMismatch) message = 'Utiliza el formato indicado para este campo.'
  else if (validity.tooLong) message = `Usa como máximo ${control.maxLength} caracteres.`
  return `${label}: ${message}`
}

// Complementa los mensajes visibles de toda la interfaz, incluidos errores SSR y modales.
// No intercepta HTTP: una renovación de sesión o un reintento recuperado no es un error del usuario.
export function observeInterfaceErrors(document, notify) {
  let previous = new Map(), queued = false, stopped = false
  function scan() {
    queued = false
    if (stopped) return
    const current = new Map(), messages = new Set()
    const topDialog = [...document.querySelectorAll('dialog[open]')].at(-1)
    for (const element of document.querySelectorAll('[role="alert"]')) {
      if (element.closest('[data-toast-region], [hidden], [aria-hidden="true"], [inert], dialog:not([open])')) continue
      if (topDialog && !topDialog.contains(element)) continue
      if (!element.getClientRects().length || document.defaultView.getComputedStyle(element).visibility === 'hidden' || element.parentElement?.closest('[role="alert"]')) continue
      const text = alertText(element)
      if (!text) continue
      current.set(element, text)
      if (previous.get(element) !== text) messages.add(text)
    }
    previous = current
    for (const text of messages) notify(text)
  }
  function schedule() { if (!queued && !stopped) { queued = true; queueMicrotask(scan) } }
  const observer = new document.defaultView.MutationObserver(records => {
    if (records.some(record => !record.target.parentElement?.closest('[data-toast-region]') && !record.target.closest?.('[data-toast-region]'))) schedule()
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['role', 'hidden', 'aria-hidden', 'inert', 'open', 'class', 'style'] })
  let invalidQueued = false
  function invalid(event) {
    if (invalidQueued || !event.target.validity) return
    invalidQueued = true
    notify(invalidMessage(event.target))
    queueMicrotask(() => { invalidQueued = false })
  }
  document.addEventListener('invalid', invalid, true)
  scan()
  return () => { stopped = true; observer.disconnect(); document.removeEventListener('invalid', invalid, true); previous.clear() }
}
