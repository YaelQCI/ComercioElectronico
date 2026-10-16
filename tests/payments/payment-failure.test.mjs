import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentFailure, safePaymentDiagnostic } from '../../server/features/payments/payment-failure.js'
import { ShippingProviderError } from '../../server/features/shipping/envia-rates.js'
import { CartError } from '../../server/features/cart/cart-repository.js'
import { PaymentError } from '../../server/features/payments/stripe-client.js'
test('conserva los errores de negocio de pago, carrito y proveedor de envío', () => {
  assert.deepEqual(paymentFailure(new ShippingProviderError('Tarifa no disponible.')), { statusCode: 503, statusMessage: 'Tarifa no disponible.' })
  assert.deepEqual(paymentFailure(new CartError(409, 'Revisa existencias.')), { statusCode: 409, statusMessage: 'Revisa existencias.' })
  assert.deepEqual(paymentFailure(new PaymentError(409, 'Tarifa cambió.')), { statusCode: 409, statusMessage: 'Tarifa cambió.' })
  assert.equal(paymentFailure(new Error('Datos privados')), null)
})
test('diagnóstico interno registra solo códigos permitidos y no mensajes, consultas ni secretos', () => {
  const error = Object.assign(new Error('correo privado y secreto'), { code: 'P2034', meta: { query: 'dato privado', driverAdapterError: { cause: { originalCode: '40P01' } } } })
  assert.deepEqual(safePaymentDiagnostic(error, 'start'), { operation: 'start', errorType: 'Error', code: 'P2034', databaseCode: '40P01' })
  assert.equal(JSON.stringify(safePaymentDiagnostic(error, 'start')).includes('privado'), false)
  assert.deepEqual(safePaymentDiagnostic({ name: 'Error con datos', code: 'SQL con datos' }, 'dato privado'), { operation: 'unknown', errorType: null, code: null, databaseCode: null })
})
