import { createStripeClient, PaymentError } from './stripe-client.js'
export function configuredStripeClient(config) {
  if (config.stripeEnabled !== true && config.stripeEnabled !== 'true') throw new PaymentError(503, 'Pago pendiente de habilitar.')
  if (typeof config.stripeWebhookSecret !== 'string' || !/^whsec_[A-Za-z0-9]{6,}$/.test(config.stripeWebhookSecret)) throw new PaymentError(503, 'Webhook de Stripe pendiente de configurar.')
  if (!/^[1-9]\d{0,11}$/.test(config.stripeMinimumCents ?? '1000')) throw new PaymentError(503, 'Mínimo de pago Stripe inválido.')
  return createStripeClient({ secretKey: config.stripeSecretKey, environment: config.stripeEnvironment, siteUrl: config.stripeSiteUrl })
}
export function stripePaymentReady(config) {
  try { configuredStripeClient(config); return true } catch { return false }
}
