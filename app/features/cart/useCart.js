export async function useCart() {
  const busy = useState('cart-mutation-busy', () => false)
  const message = useState('cart-message', () => '')
  const failure = useState('cart-failure', () => '')
  const { data, error, status, refresh } = await useFetch('/api/cart', { key: 'store-cart' })
  async function add(variantId, quantity, buyNow = false) {
    if (busy.value) return
    busy.value = true; message.value = ''; failure.value = ''
    try {
      if (!data.value || error.value) { await refresh(); if (error.value || !data.value) throw new Error('No pudimos recuperar el carrito.') }
      data.value = await $fetch('/api/cart/items', { method: 'POST', body: { variantId, quantity: Number(quantity), version: data.value.version } })
      message.value = `Producto agregado. ${data.value.pieces} piezas en ${data.value.products} líneas de producto.`
      if (buyNow) await navigateTo('/carrito')
    } catch (e) {
      failure.value = e.data?.statusMessage ?? e.message ?? 'No pudimos agregar el producto.'
      await refresh()
    } finally { busy.value = false }
  }
  return { data, error, status, refresh, busy, message, failure, add }
}
