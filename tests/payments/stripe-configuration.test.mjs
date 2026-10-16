import test from 'node:test'
import assert from 'node:assert/strict'
import { configuredStripeClient, stripePaymentReady } from '../../server/features/payments/stripe-configuration.js'
const valid = { stripeEnabled: true, stripeEnvironment: 'test', stripeSecretKey: 'sk_test_fixture', stripeWebhookSecret: 'whsec_fixture123', stripeSiteUrl: 'http://localhost:3001', stripeMinimumCents: '1000' }
test('el pago requiere configuración completa y consistente, sin llamadas a Stripe', () => {
  assert.equal(stripePaymentReady(valid), true)
  assert.equal(stripePaymentReady({ ...valid, stripeEnabled: 'true' }), true)
  assert.equal(configuredStripeClient(valid).environment, 'test')
  for (const change of [{ stripeEnabled: false }, { stripeSecretKey: '' }, { stripeSecretKey: 'sk_live_fixture' }, { stripeWebhookSecret: '' }, { stripeWebhookSecret: 'sk_test_not_webhook' }, { stripeSiteUrl: '' }, { stripeSiteUrl: 'http://localhost:3001/path' }, { stripeMinimumCents: '0' }, { stripeMinimumCents: '-1' }]) {
    assert.equal(stripePaymentReady({ ...valid, ...change }), false)
    assert.throws(() => configuredStripeClient({ ...valid, ...change }))
  }
})
