import test from 'node:test'
import assert from 'node:assert/strict'
import { createEnviaRates, decimalRateCents } from '../../server/features/shipping/envia-rates.js'
const address = { name: 'Fixture sintético', phone: '5555555555', street: 'Calle sintética 1', city: 'Ciudad sintética', state: 'CX', country: 'MX', postalCode: '01234' }
const input = { origin: address, destination: address, package: { grossWeightGrams: 1500, lengthMm: 201, widthMm: 300, heightMm: 100 }, goodsCents: '149900', content: 'Prueba aislada' }
const rate = { carrier: 'fixture', service: 'ground', serviceDescription: 'Servicio sintético', totalPrice: '125.50', currency: 'MXN', deliveryEstimate: 'Estimación sintética del proveedor' }
test('cliente solo expone cotización y usa POST rate con peso bruto/medidas/unidades; no genera guías', async () => {
  const calls = []
  const client = createEnviaRates({ token: 'test-double-not-secret', carrier: 'fixture', fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ meta: 'rate', data: [rate] })) } })
  assert.deepEqual(Object.keys(client), ['quote'])
  const result = await client.quote(input)
  assert.equal(result[0].quotedAmountCents, '12550')
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api-test.envia.com/ship/rate/')
  assert.equal(calls[0].options.method, 'POST'); assert.equal(calls[0].options.redirect, 'error')
  const sent = JSON.parse(calls[0].options.body)
  assert.equal(sent.packages.length, 1); assert.equal(sent.packages[0].weight, 1.5); assert.equal(sent.packages[0].dimensions.length, 20.1); assert.equal(sent.destination.postalCode, '01234')
  // Forbidden operations do not exist. No network request is made to test them.
  for (const method of ['generate', 'pickup', 'request']) assert.equal(client[method], undefined)
})
test('sin cobertura devuelve lista vacía; errores, formatos, moneda y tarifas inválidas fallan cerrado', async () => {
  const empty = createEnviaRates({ token: 'test-double', carrier: 'fixture', fetchImpl: async () => new Response(JSON.stringify({ meta: 'rate', data: [] })) })
  assert.deepEqual(await empty.quote(input), [])
  for (const payload of [{ meta: 'error', data: [] }, { meta: 'rate', data: [{ ...rate, currency: 'USD' }] }, { meta: 'rate', data: [{ ...rate, totalPrice: '-1' }] }]) {
    const client = createEnviaRates({ token: 'test-double', carrier: 'fixture', fetchImpl: async () => new Response(JSON.stringify(payload)) })
    await assert.rejects(client.quote(input), /No pudimos cotizar/)
  }
  const timeout = createEnviaRates({ token: 'test-double', carrier: 'fixture', fetchImpl: async () => { throw new Error('Timeout') } })
  await assert.rejects(timeout.quote(input), /No pudimos cotizar/)
  assert.throws(() => createEnviaRates({ token: 'fixture', carrier: 'fixture', environment: 'https://example.invalid' }), /configurada/)
})
test('precios se convierten sin redondeo flotante ni aceptar fracciones de centavo', () => {
  assert.equal(decimalRateCents('0.01'), '1'); assert.equal(decimalRateCents(125.5), '12550')
  for (const value of ['1.005', '-1', 'NaN', null]) assert.throws(() => decimalRateCents(value))
})
