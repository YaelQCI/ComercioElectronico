import test from 'node:test'
import assert from 'node:assert/strict'
import { guardNumericEntry, numericValueError } from '../../app/components/numeric-input.js'
import { controlError } from '../../app/components/form-validation.js'
import { variantData } from '../../server/features/catalog/variant-input.js'
import { packageConfiguration } from '../../shared/features/shipping/package-configuration.js'
import { pesosToCents } from '../../app/features/administration/price-input.js'
import { phoneFormatError } from '../../shared/features/accounts/phone.js'
import { createAccounts } from '../../server/features/accounts/account-repository.js'

const integer = (changes = {}) => ({ type: 'number', step: '1', min: '1', value: '12', ...changes })
function paste(control, text) {
  const event = { type: 'paste', target: control, clipboardData: { getData: () => text }, preventDefault() { this.defaultPrevented = true } }
  const message = guardNumericEntry(event)
  return { blocked: !!event.defaultPrevented, message }
}
test('no acepta letras, exponentes, hexadecimales, separadores o fracciones en enteros', () => {
  for (const value of ['12abc', '1e3', '0x10', '1 000', '1,000', '1.5', '+12', '-12', ' 12 ']) {
    assert.ok(numericValueError(integer(), value), value)
    assert.equal(paste(integer(), value).blocked, true, value)
  }
  assert.equal(numericValueError(integer(), '123'), '')
  assert.equal(paste(integer(), '123').blocked, false)
  const control = integer()
  paste(control, '12abc')
  assert.equal(control.value, '12', 'una entrada inválida no se convierte ni reemplaza el valor anterior')
})
test('permite negativos solo para ajustes y coma decimal solo en campos compatibles', () => {
  assert.equal(numericValueError(integer({ min: '-2147483647' }), '-2'), '')
  assert.equal(paste(integer({ min: '-2147483647' }), '-2').blocked, false)
  const money = { type: 'text', inputMode: 'decimal', value: '' }
  assert.equal(paste(money, '12,50').blocked, false)
  assert.equal(pesosToCents('12,50'), '1250')
  assert.equal(paste(money, '12.5.0').blocked, true)
  assert.equal(paste(integer({ step: '0.0001', min: '0' }), '0.125').blocked, false)
  assert.equal(paste(integer({ step: '0.01' }), '12,50').blocked, true)
})
test('teclado y pegado rechazan caracteres sin limitar nombres ni números de dirección', () => {
  const event = { type: 'beforeinput', inputType: 'insertText', data: 'e', target: integer(), preventDefault() { this.defaultPrevented = true } }
  assert.ok(guardNumericEntry(event))
  assert.equal(event.defaultPrevented, true)
  assert.equal(paste({ type: 'text', value: '' }, 'María José').blocked, false)
  assert.equal(paste({ type: 'text', value: '' }, 'S/N').blocked, false)
  assert.equal(paste({ type: 'text', inputMode: 'numeric', value: '' }, '01000').blocked, false)
})
test('el envío también rechaza exponentes aunque se omitan los eventos del teclado', () => {
  assert.match(controlError({ ...integer(), willValidate: true, validity: { valid: true }, labels: [{ textContent: 'Cantidad' }], value: '1e3' }), /^Cantidad: usa solo dígitos/)
})

test('teléfonos permiten formato internacional y rechazan letras', async () => {
  assert.equal(phoneFormatError('+52 (444) 123-4567'), '')
  assert.equal(paste({ type: 'tel', value: '' }, '+52 (444) 123-4567').blocked, false)
  assert.equal(paste({ type: 'tel', value: '' }, 'teléfono123').blocked, true)
  assert.ok(phoneFormatError('teléfono123'))
  assert.equal(phoneFormatError(''), '', 'el teléfono opcional puede quedar vacío')
  const accounts = createAccounts({ $transaction: () => { throw Error('No debe escribir datos inválidos') } }, '')
  await assert.rejects(accounts.updateProfile('fixture', { displayName: 'Fixture', phone: 'abc123' }), /Teléfono: usa dígitos/)
})
test('el servidor no acepta cadenas numéricas adulteradas ni medidas fraccionarias', () => {
  const variant = { sku: 'SKU', flavor: 'Natural', presentationLabel: 'Bolsa', contentUnit: 'g', contentAmount: '1', priceCents: '100', weightGrams: 1, lengthMm: 1, widthMm: 1, heightMm: 1 }
  for (const weightGrams of ['12abc', '1e3', '12', 1.5, Infinity]) assert.throws(() => variantData({ ...variant, weightGrams }), /Peso en gramos/)
  assert.throws(() => variantData({ ...variant, contentAmount: '1e3' }), /Contenido/)
  assert.throws(() => pesosToCents('1e3'), /importe/)
  const box = { code: 'CAJA', isActive: true, innerLengthMm: 1, innerWidthMm: 1, innerHeightMm: 1, outerLengthMm: 1, outerWidthMm: 1, outerHeightMm: 1, tareWeightGrams: 0, maxGrossWeightGrams: null }
  assert.throws(() => packageConfiguration({ ...box, outerLengthMm: '12abc' }), /Largo exterior/)
})
