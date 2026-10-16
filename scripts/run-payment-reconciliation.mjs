import 'dotenv/config'
import { setTimeout } from 'node:timers/promises'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { configuredStripeClient } from '../server/features/payments/stripe-configuration.js'
import { createOrderPayments } from '../server/features/payments/order-payments.js'

const controller = new AbortController()
process.once('SIGTERM', () => controller.abort())
process.once('SIGINT', () => controller.abort())
let db
try {
  const stripe = configuredStripeClient({ stripeEnabled: process.env.NUXT_STRIPE_ENABLED, stripeSecretKey: process.env.NUXT_STRIPE_SECRET_KEY, stripeWebhookSecret: process.env.NUXT_STRIPE_WEBHOOK_SECRET, stripeEnvironment: process.env.NUXT_STRIPE_ENVIRONMENT ?? 'test', stripeSiteUrl: process.env.NUXT_STRIPE_SITE_URL, stripeMinimumCents: process.env.NUXT_STRIPE_MINIMUM_CENTS ?? '1000' })
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' }) })
  const payments = createOrderPayments(db, stripe, null, { minimumCents: process.env.NUXT_STRIPE_MINIMUM_CENTS ?? '1000' })
  while (!controller.signal.aborted) {
    try {
      const results = await payments.sweep()
      console.log(JSON.stringify({ checked: results.length, pending: results.filter(result => result.pending).length }))
    } catch { console.error('No se pudo completar la revisión de pagos. Se reintentará; no se liberan reservas sin comprobar el proveedor.') }
    try { await setTimeout(60000, undefined, { signal: controller.signal }) } catch (error) { if (error.name !== 'AbortError') throw error }
  }
} catch { console.error('Reconciliación no iniciada. Revisa la configuración privada de Stripe y de la base de datos.'); process.exitCode = 1 }
finally { await db?.$disconnect() }
