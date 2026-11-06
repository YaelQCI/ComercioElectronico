import test from 'node:test'
import assert from 'node:assert/strict'
import { controlError, formErrors } from '../../app/components/form-validation.js'
import { accountText } from '../../server/features/accounts/credentials.js'
import { variantData } from '../../server/features/catalog/variant-input.js'
import { pesosToCents } from '../../app/features/administration/price-input.js'

const control = (changes = {}) => ({ willValidate: true, type: 'text', tagName: 'INPUT', value: '', labels: [{ textContent: 'Nombre *' }], validity: { valid: true }, getAttribute: () => null, ...changes })
test('identifica cada campo obligatorio, incluidos espacios, selección, archivo y consentimiento', () => {
  assert.match(controlError(control({ required: true, value: '   ' })), /^Nombre: no uses solo espacios/)
  for (const [type, message] of [['checkbox', /marca esta casilla/], ['radio', /selecciona una opción/], ['file', /selecciona el archivo/]]) {
    assert.match(controlError(control({ type, required: true, validity: { valueMissing: true } })), message)
  }
  assert.equal(controlError(control({ willValidate: false, required: true })), '')
  assert.equal(controlError(control({ value: '' })), '')
})
test('explica correo, longitud de contraseña, bytes, rango, enteros y formato postal', () => {
  assert.match(controlError(control({ type: 'email', value: 'incorrecto', validity: { typeMismatch: true } })), /nombre@dominio.com/)
  assert.match(controlError(control({ type: 'password', value: 'corta', minLength: 12 })), /al menos 12 caracteres/)
  assert.match(controlError(control({ type: 'password', value: 'á'.repeat(129), maxLength: 256 })), /256 bytes/)
  assert.match(controlError(control({ value: '1.5', type: 'number', step: '1', validity: { stepMismatch: true } })), /entero, sin decimales/)
  assert.match(controlError(control({ value: '-1', min: '0', validity: { rangeUnderflow: true } })), /mínimo permitido es 0/)
  assert.match(controlError(control({ value: '123', pattern: '[0-9]{5}', validity: { patternMismatch: true } })), /exactamente cinco dígitos/)
})
test('conserva el error de negocio y resume todos los campos sin revelar sus valores', () => {
  const field = control({ value: 'secreto-no-mostrar', validity: { customError: true }, validationMessage: 'Selecciona una variante de la lista.' })
  assert.equal(controlError(field), 'Nombre: Selecciona una variante de la lista.')
  const errors = formErrors({ elements: [field, control({ value: 'válido' }), control({ required: true })] })
  assert.equal(errors.length, 2)
  assert.ok(errors.every(error => !error.message.includes('secreto-no-mostrar')))
  const rating = () => control({ type: 'radio', name: 'rating', validity: { valueMissing: true }, closest: () => ({ querySelector: () => ({ textContent: 'Tu calificación' }) }) })
  const ratingErrors = formErrors({ elements: [rating(), rating(), rating()] })
  assert.equal(ratingErrors.length, 1)
  assert.match(ratingErrors[0].message, /^Tu calificación: selecciona una opción/)
})
test('servidor identifica el campo, la medida y el importe que bloquean el guardado', () => {
  assert.throws(() => accountText(' ', 'Motivo', 500), /Motivo: completa este campo/)
  assert.throws(() => accountText('a'.repeat(121), 'Nombre', 120), /Nombre: usa como máximo 120/)
  const variant = { sku: 'SKU', flavor: 'Natural', presentationLabel: 'Bolsa', contentUnit: 'g', contentAmount: '1', priceCents: '100', weightGrams: 1, lengthMm: 1, widthMm: 1, heightMm: 0 }
  assert.throws(() => variantData(variant), /Alto en milímetros: escribe un entero/)
  assert.throws(() => pesosToCents('1.001', 'Compra mínima'), /Compra mínima: escribe un importe/)
})
