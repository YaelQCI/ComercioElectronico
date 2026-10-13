<script setup>
import { useCart } from './useCart.js'
import { formatMXN } from '~~/shared/features/pricing/prices.js'
const { data, error, status, refresh } = await useCart()
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-8 md:px-8" :aria-busy="status === 'pending'">
    <UiBreadcrumbs :items="[{ label: 'Carrito' }]" /><h1 class="text-display-l font-bold">Tu carrito</h1>
    <UiLoading v-if="status === 'pending'" label="Recuperando carrito…" :cards="1" />
    <div v-else-if="error" role="alert"><p class="mt-6">No pudimos recuperar tu carrito.</p><UiButton class="mt-4" @click="refresh()">Reintentar</UiButton></div>
    <template v-else-if="data?.lines.length">
      <p class="mt-4">{{ data.pieces }} piezas en {{ data.products }} líneas de producto. El carrito no reserva existencias.</p>
      <ul class="mt-6 space-y-4"><li v-for="line in data.lines" :key="line.id" class="rounded-sm border border-line bg-surface p-4"><NuxtLink v-if="line.productId" :to="{ path: `/producto/${line.productId}`, query: { variante: line.variantId } }" class="font-semibold underline">{{ line.name }}</NuxtLink><span v-else class="font-semibold">{{ line.name }}</span><p>{{ line.presentation }} · SKU {{ line.sku }}</p><p>{{ line.quantity }} × {{ formatMXN(line.unitPriceCents) }} = {{ formatMXN((BigInt(line.unitPriceCents) * BigInt(line.quantity)).toString()) }}</p><p v-if="!line.valid || !line.stockSufficient" role="alert" class="mt-2 text-crit">Esta selección requiere revisión: publicación o existencias cambiaron.</p></li></ul>
      <p class="mt-6 font-mono font-semibold">Total provisional de productos: {{ formatMXN(data.totals.goodsMoneyCents) }}</p><p class="mt-2 text-ink-2">Envío pendiente de cotizar; puede aumentar el total. Cupones y puntos se calcularán cuando estén habilitados.</p><UiButton class="mt-6" disabled>Pago pendiente de habilitar</UiButton>
    </template>
    <div v-else class="mt-6"><p>Tu carrito está vacío.</p><UiButton class="mt-4" to="/catalogo">Explorar catálogo</UiButton></div>
  </section>
</template>
