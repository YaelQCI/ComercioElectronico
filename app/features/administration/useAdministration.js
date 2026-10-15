export function useAdministration(refresh) {
  const busy = ref(false), failure = ref(''), message = ref('')
  async function save(path, body, method = 'POST') {
    if (busy.value) return false
    busy.value = true; failure.value = ''; message.value = ''
    try {
      await $fetch(path, { method, body })
      message.value = 'Cambio guardado.'
      await refresh()
      return true
    } catch (error) {
      failure.value = error.data?.statusMessage ?? 'No pudimos completar la operación. Actualiza los datos antes de reintentar.'
      return false
    } finally { busy.value = false }
  }
  return { busy, failure, message, save }
}
