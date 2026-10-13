import { observeCart } from './cart-observation.js'

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
      observeCart(data.value)
      message.value = `Producto agregado. ${data.value.pieces} piezas en ${data.value.products} líneas de producto.`
      if (buyNow) await navigateTo('/carrito')
    } catch (e) {
      failure.value = e.data?.statusMessage ?? e.message ?? 'No pudimos agregar el producto.'
      await refresh()
    } finally { busy.value = false }
  }
  async function edit(itemId, quantity, remove = false) {
    if (busy.value || !data.value) return
    busy.value = true; message.value = ''; failure.value = ''
    try {
      data.value = await $fetch('/api/cart/items', { method: remove ? 'DELETE' : 'PATCH', body: { itemId, quantity: Number(quantity), version: data.value.version } })
      observeCart(data.value)
      message.value = remove ? 'Producto eliminado del carrito.' : 'Cantidad y resumen actualizados.'
    } catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos actualizar el carrito.'; await refresh() }
    finally { busy.value = false }
  }
  async function move(itemId, action) {
    if (busy.value || !data.value) return
    busy.value = true; message.value = ''; failure.value = ''
    try {
      data.value = await $fetch('/api/cart/saved', { method: 'POST', body: { itemId, action, version: data.value.version } })
      observeCart(data.value)
      message.value = action === 'SAVE' ? 'Producto guardado para después.' : action === 'RESTORE' ? 'Producto movido al carrito.' : 'Producto guardado eliminado.'
    } catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos actualizar los guardados.'; await refresh() }
    finally { busy.value = false }
  }
  return { data, error, status, refresh, busy, message, failure, add, edit, move }
}
