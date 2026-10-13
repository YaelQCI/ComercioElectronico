import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  runtimeConfig: {
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    public: { stripePublishableKey: '' },
  },
  app: { head: { htmlAttrs: { lang: 'es' }, title: 'The Fitness Stuff' } },
})
