export function usePaymentStatus(orderId) {
  const data = ref(null), busy = ref(false), failure = ref(''), updatedAt = ref(null)
  let disposed = false, refreshQueued = false, lastReturnAt = -Infinity
  const visible = () => document.visibilityState === 'visible'
  async function read() {
    const result = await $fetch('/api/payments/status', { method: 'POST', body: { orderId } })
    if (!disposed) { data.value = result; updatedAt.value = Date.now() }
  }
  function finish() {
    busy.value = false
    if (refreshQueued && !disposed && visible()) { refreshQueued = false; queueMicrotask(consult) }
  }
  async function consult() {
    if (disposed) return
    if (busy.value) { refreshQueued = true; return }
    refreshQueued = false; busy.value = true; failure.value = ''
    try { await read() }
    catch (e) { if (!disposed) failure.value = e.data?.statusMessage ?? 'No pudimos actualizar tu pedido. Intenta de nuevo en un momento.' }
    finally { finish() }
  }
  async function cancel() {
    if (busy.value || disposed || !data.value) return
    busy.value = true; failure.value = ''
    try { await $fetch('/api/payments/cancel', { method: 'POST', body: { orderId } }); await read() }
    catch (e) { if (!disposed) failure.value = e.data?.statusMessage ?? 'No pudimos cerrar el intento. Consulta su estado antes de reintentar.' }
    finally { finish() }
  }
  async function resume() {
    if (busy.value || disposed || !data.value) return
    busy.value = true; failure.value = ''
    try {
      const result = await $fetch('/api/payments/start', { method: 'POST', body: { orderId, acceptedTotalCents: data.value.totalMoneyCents } })
      if (disposed) return
      if (result.url) await navigateTo(result.url, { external: true })
      else await read()
    } catch (e) { if (!disposed) failure.value = e.data?.statusMessage ?? 'No pudimos reanudar el pago. Consulta su estado antes de reintentar.' }
    finally { finish() }
  }
  function returned() {
    if (!visible() || disposed || Date.now() - lastReturnAt < 500) return
    lastReturnAt = Date.now()
    void consult()
  }
  function restored(event) { if (event.persisted) returned() }
  onMounted(() => {
    void consult()
    document.addEventListener('visibilitychange', returned)
    window.addEventListener('focus', returned)
    window.addEventListener('pageshow', restored)
  })
  onBeforeUnmount(() => {
    disposed = true; refreshQueued = false
    document.removeEventListener('visibilitychange', returned)
    window.removeEventListener('focus', returned)
    window.removeEventListener('pageshow', restored)
  })
  return { data, busy, failure, updatedAt, consult, cancel, resume }
}
