export function useAccountLogout() {
  const busy = ref(false)
  const nuxtApp = useNuxtApp()
  const { data } = useNuxtData('account-session')
  const { confirm, error } = useToasts()
  async function logout() {
    if (busy.value) return
    busy.value = true
    try {
      await $fetch('/api/account/logout', { method: 'POST', body: {} })
      if (data.value) data.value = { ...data.value, user: null }
      await nuxtApp.runWithContext(() => navigateTo('/cuenta'))
      await nuxtApp.runWithContext(() => refreshNuxtData())
      confirm('Sesión cerrada.')
    } catch (failure) {
      error(failure.data?.statusMessage ?? 'No pudimos cerrar la sesión. Intenta nuevamente.')
    } finally { busy.value = false }
  }
  return { busy, logout }
}
