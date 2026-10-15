import { createSessionFetch } from '~/features/accounts/session-renewal.js'

export default defineNuxtPlugin(nuxtApp => {
  const session = useNuxtData('account-session')
  let mounted = false
  function applySession(value) {
    const recovered = !session.data.value?.user && !!value?.user
    session.data.value = value
    if (recovered) void nuxtApp.runWithContext(() => refreshNuxtData())
  }
  const originalFetch = globalThis.fetch.bind(globalThis)
  const coordinator = createSessionFetch({
    fetch: originalFetch,
    origin: location.origin,
    lock: navigator.locks ? task => navigator.locks.request('fitness-account-session', task) : undefined,
    onSession: value => { if (mounted) applySession(value) },
  })
  globalThis.fetch = coordinator.fetch
  // No se modifica el payload antes de terminar la hidratación.
  nuxtApp.hook('app:mounted', async () => {
    mounted = true
    try {
      const current = await coordinator.check()
      if (current) applySession(current)
    } catch { /* Las peticiones muestran sus errores y permiten reintentar. */ }
  })
  const resume = async () => {
    if (document.visibilityState !== 'visible') return
    coordinator.invalidate()
    try { const current = await coordinator.check(); if (current) applySession(current) } catch {}
  }
  document.addEventListener('visibilitychange', resume)
  nuxtApp.hook('app:beforeUnmount', () => {
    document.removeEventListener('visibilitychange', resume)
    globalThis.fetch = originalFetch
  })
})
