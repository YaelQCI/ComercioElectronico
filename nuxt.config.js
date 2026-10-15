import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  runtimeConfig: {
    authSecret: '',
    catalogAssetDirectory: '',
    catalogUploadDirectory: '',
    restockTokenSecret: '',
    enviaToken: '',
    enviaEnvironment: 'test',
    enviaCarrier: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    stripeEnabled: false,
    stripeEnvironment: 'test',
    stripeSiteUrl: '',
    stripeMinimumCents: '1000',
    public: {
      stripePublishableKey: '',
      contactEmail: '',
      contactPhone: '',
      serviceHours: '',
    },
  },
  app: { head: { htmlAttrs: { lang: 'es' }, title: 'The Fitness Stuff' } },
})
