import tailwindcss from '@tailwindcss/vite'
import { themeBootstrap } from './app/features/appearance/theme.js'

export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  runtimeConfig: {
    catalogAssetDirectory: '',
    restockTokenSecret: '',
    enviaToken: '',
    enviaEnvironment: 'test',
    enviaCarrier: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    public: {
      stripePublishableKey: '',
      contactEmail: '',
      contactPhone: '',
      serviceHours: '',
    },
  },
  app: { head: { htmlAttrs: { lang: 'es' }, title: 'The Fitness Stuff', script: [{ key: 'fitness-theme', innerHTML: themeBootstrap, tagPosition: 'head' }] } },
})
