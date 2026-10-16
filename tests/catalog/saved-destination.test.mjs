import test from 'node:test'
import assert from 'node:assert/strict'
import { savedDestination } from '../../shared/features/shipping/saved-destination.js'
const address = { recipientName: 'Destinatario sintético', phone: '0000000000', street: 'Calle de prueba', exteriorNumber: '10', interiorNumber: '2', district: 'Colonia sintética', city: 'Ciudad sintética', state: 'San Luis Potosí', countryCode: 'MX', postalCode: '01234' }

test('dirección guardada completa destino con números, colonia, teléfono y código estatal de Envia', () => {
  assert.deepEqual(savedDestination(address), { name: address.recipientName, phone: address.phone, street: 'Calle de prueba 10 int. 2, Colonia sintética', city: address.city, state: 'SL', country: 'MX', postalCode: '01234' })
  assert.equal(savedDestination({ ...address, interiorNumber: null }).street, 'Calle de prueba 10, Colonia sintética')
  assert.equal(savedDestination({ ...address, state: 'san luis potosi' }).state, 'SL')
  assert.equal(savedDestination({ ...address, state: 'cx' }).state, 'CX')
  assert.equal(savedDestination({ ...address, state: 'Ciudad de México' }).state, 'CX')
  assert.equal(savedDestination({ ...address, state: 'Estado de México' }).state, 'EM')
})

test('un estado desconocido queda pendiente de selección sin inventar código ni alterar la dirección guardada', () => {
  const original = { ...address, state: 'Estado sin documentar' }
  assert.equal(savedDestination(original).state, '')
  assert.equal(original.state, 'Estado sin documentar')
  assert.equal(savedDestination({}).state, '')
})
