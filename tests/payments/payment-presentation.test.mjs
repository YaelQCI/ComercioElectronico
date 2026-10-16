import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentPresentation } from '../../app/features/payments/payment-presentation.js'
test('solo celebra pago verificado y pedido confirmado o posterior, sin confundir total cero', () => {
  for (const status of ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED']) {
    assert.equal(paymentPresentation({ status, moneyStatus: 'PAID' }).kind, 'success')
    const free = paymentPresentation({ status, moneyStatus: 'NOT_REQUIRED' })
    assert.equal(free.kind, 'success'); assert.match(free.description, /No fue necesario/)
  }
  for (const data of [null, { status: 'PENDING_PAYMENT', moneyStatus: 'PENDING' }, { status: 'PENDING_PAYMENT', moneyStatus: 'PAID' }, { status: 'CANCELED', moneyStatus: 'PAID' }, { status: 'CONFIRMED', moneyStatus: 'REFUNDED' }, { status: 'DELIVERED', moneyStatus: 'PARTIALLY_REFUNDED' }, { status: 'PENDING_PAYMENT', moneyStatus: 'RECONCILING' }]) assert.notEqual(paymentPresentation(data).kind, 'success')
})
test('explica rechazo, revisión, cancelación y reembolso sin celebrar un pago pendiente', () => {
  assert.equal(paymentPresentation({ status: 'PENDING_PAYMENT', moneyStatus: 'FAILED' }).kind, 'warning')
  assert.equal(paymentPresentation({ status: 'PENDING_PAYMENT', moneyStatus: 'PENDING', cardRejected: true }).kind, 'warning')
  assert.equal(paymentPresentation({ status: 'PENDING_PAYMENT', moneyStatus: 'PENDING', needsReview: true }).kind, 'review')
  assert.equal(paymentPresentation({ status: 'CANCELED', moneyStatus: 'PENDING' }).kind, 'neutral')
  assert.equal(paymentPresentation({ status: 'DELIVERED', moneyStatus: 'REFUNDED' }).kind, 'refund')
})
