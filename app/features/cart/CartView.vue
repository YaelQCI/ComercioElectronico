<script setup>
import { useCart } from './useCart.js'
import { formatMXN } from '~~/shared/features/pricing/prices.js'
import { observeCart } from './cart-observation.js'
const { data, error, status, refresh, busy, edit } = await useCart()
const drafts = ref({})
const inputErrors = ref({})
const changes = ref([])
onMounted(() => { changes.value = observeCart(data.value) })
watch(data, value => { drafts.value = Object.fromEntries((value?.lines ?? []).map(l => [l.id, String(l.quantity)])); inputErrors.value = {} }, { immediate: true })
function update(line) {
  const value = drafts.value[line.id]
  if (!/^\d+$/.test(value) || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > line.maxQuantity) { inputErrors.value[line.id] = 'Usa un entero entre 1 y el stock disponible para esta línea.'; return }
  inputErrors.value[line.id] = ''
  edit(line.id, Number(value))
}
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-8 md:px-8" :aria-busy="status === 'pending'">
    <UiBreadcrumbs :items="[{ label: 'Carrito' }]" /><h1 class="text-display-l font-bold">Tu carrito</h1>
    <UiLoading v-if="status === 'pending'" label="Recuperando carrito…" :cards="1" />
    <div v-else-if="error" role="alert"><p class="mt-6">No pudimos recuperar tu carrito.</p><UiButton class="mt-4" @click="refresh()">Reintentar</UiButton></div>
    <template v-else-if="data?.lines.length">
      <ul v-if="changes.length" role="status" class="mt-4 text-body-s text-crit"><li v-for="notice in changes" :key="notice">{{ notice }}</li></ul>
      <p class="mt-4">{{ data.pieces }} piezas en {{ data.products }} líneas de producto. El carrito no reserva existencias.</p>
      <ul class="mt-6 space-y-4"><li v-for="line in data.lines" :key="line.id" class="rounded-sm border border-line bg-surface p-4">
        <div class="flex flex-wrap gap-4"><UiImage :src="line.image?.url" :alt="line.image?.alt ?? line.name" class="h-28 w-28 shrink-0" /><div><NuxtLink v-if="line.productId" :to="{ path: `/producto/${line.productId}`, query: { variante: line.variantId } }" class="font-semibold underline">{{ line.name }}</NuxtLink><span v-else class="font-semibold">{{ line.name }}</span><p>{{ line.presentation }} · SKU {{ line.sku }}</p><p>{{ line.quantity }} × {{ formatMXN(line.unitPriceCents) }} = {{ formatMXN((BigInt(line.unitPriceCents) * BigInt(line.quantity)).toString()) }}</p></div></div>
        <p v-if="!line.valid || !line.stockSufficient" role="alert" class="mt-2 text-crit">Esta selección requiere revisión: publicación o existencias cambiaron.</p>
        <form class="mt-4 flex flex-wrap items-end gap-2" @submit.prevent="update(line)"><UiButton variant="secondary" :disabled="busy || line.quantity <= 1" :aria-label="`Restar una pieza de ${line.name}`" @click="edit(line.id, line.quantity - 1)">−</UiButton><UiField :id="`quantity-${line.id}`" v-model="drafts[line.id]" label="Cantidad" type="number" min="1" step="1" :max="Math.max(1, line.maxQuantity)" :disabled="busy" :error="inputErrors[line.id]" class="max-w-36" /><UiButton variant="secondary" :disabled="busy || line.quantity >= line.maxQuantity" :aria-label="`Agregar una pieza de ${line.name}`" @click="edit(line.id, line.quantity + 1)">+</UiButton><UiButton type="submit" variant="secondary" :disabled="busy">Actualizar</UiButton><UiButton variant="secondary" :disabled="busy" :aria-label="`Quitar ${line.name} del carrito`" @click="edit(line.id, 0, true)">Quitar</UiButton></form>
      </li></ul>
      <p class="mt-6 font-mono font-semibold" role="status">Total provisional de productos: {{ formatMXN(data.totals.goodsMoneyCents) }}</p><p class="mt-2 text-ink-2">Envío pendiente de cotizar; puede aumentar el total. Cupones y puntos se calcularán cuando estén habilitados. Precio y stock se verifican al recuperar el carrito; lote y caducidad se asignarán al iniciar pago.</p><UiButton class="mt-6" disabled>Pago pendiente de habilitar</UiButton>
      <div class="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface p-4 lg:hidden" aria-label="Resumen del carrito móvil"><div><p class="font-mono font-semibold">Provisional {{ formatMXN(data.totals.goodsMoneyCents) }}</p><p class="text-body-s">{{ data.pieces }} piezas · Envío pendiente</p></div><UiButton disabled>Pago pendiente</UiButton></div>
    </template>
    <div v-else class="mt-6"><p>Tu carrito está vacío.</p><UiButton class="mt-4" to="/catalogo">Explorar catálogo</UiButton></div>
  </section>
</template>
