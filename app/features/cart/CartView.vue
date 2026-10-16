<script setup>
import { useCart } from './useCart.js'
import { formatMXN } from '~~/shared/features/pricing/prices.js'
import { observeCart } from './cart-observation.js'
import ConfiguredRecommendations from '../catalog/ConfiguredRecommendations.vue'
import ConfiguredBundles from '../catalog/ConfiguredBundles.vue'
import ShippingProgress from '../shipping/ShippingProgress.vue'
import ShippingCalculator from '../shipping/ShippingCalculator.vue'
import RestockForm from '../restock/RestockForm.vue'
import { canSetQuantity, limitedQuantity, stockMessage } from './stock-feedback.js'
const { data, error, status, refresh, busy, edit, move, selectedQuote, applyCoupon } = await useCart()
const code = ref('')
const quote = computed(() => selectedQuote.value?.cartVersion === data.value?.version ? selectedQuote.value : null)
const total = computed(() => data.value?.totals ? (BigInt(data.value.totals.goodsMoneyCents) + BigInt(quote.value?.chargedAmountCents ?? '0')).toString() : '0')
const drafts = ref({})
const inputErrors = ref({})
const changes = ref([])
onMounted(() => { changes.value = observeCart(data.value) })
watch(data, value => { drafts.value = Object.fromEntries((value?.lines ?? []).map(l => [l.id, limitedQuantity(l, l.quantity)])); inputErrors.value = {} }, { immediate: true })
function limit(line, value) {
  const quantity = limitedQuantity(line, value)
  drafts.value[line.id] = quantity; inputErrors.value[line.id] = ''
  // Sincroniza también el control si la cantidad limitada coincide con el valor anterior.
  nextTick(() => { const control = document.getElementById(`quantity-${line.id}`); if (control && control.value !== quantity) control.value = quantity })
}
function update(line) {
  if (!canSetQuantity(line)) return
  const value = drafts.value[line.id]
  if (!/^\d+$/.test(value) || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > line.maxQuantity) { inputErrors.value[line.id] = `Escribe una cantidad entre 1 y ${line.maxQuantity} piezas.`; return }
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
        <div class="flex flex-wrap gap-4"><div class="h-28 w-28 shrink-0"><UiImage :src="line.image?.url" :alt="line.image?.alt ?? line.name" /></div><div><NuxtLink v-if="line.productId" :to="{ path: `/producto/${line.productId}`, query: { variante: line.variantId } }" class="font-semibold underline">{{ line.name }}</NuxtLink><span v-else class="font-semibold">{{ line.name }}</span><p>{{ line.presentation }} · SKU {{ line.sku }}</p><p>{{ line.quantity }} × {{ formatMXN(line.unitPriceCents) }} = {{ formatMXN((BigInt(line.unitPriceCents) * BigInt(line.quantity)).toString()) }}</p></div></div>
        <p v-if="line.valid" class="mt-3 text-body-s text-ink-2">Disponibles: {{ line.availableQty }} piezas.<span v-if="line.maxQuantity < line.availableQty"> Máximo para esta línea: {{ line.maxQuantity }}, considerando otras líneas y combos del carrito.</span></p>
        <p v-if="stockMessage(line)" role="alert" class="mt-2 text-crit">{{ stockMessage(line) }}</p>
        <form class="mt-4" @submit.prevent="update(line)">
          <label :for="`quantity-${line.id}`" class="mb-2 block text-body-s font-semibold">Cantidad</label>
          <div class="flex flex-wrap items-center gap-2"><UiButton variant="secondary" :disabled="busy || !canSetQuantity(line) || line.quantity <= 1" :aria-label="`Restar una pieza de ${line.name}`" @click="edit(line.id, Math.min(line.maxQuantity, line.quantity - 1))">−</UiButton><input :id="`quantity-${line.id}`" :value="drafts[line.id]" type="number" min="1" step="1" :max="line.maxQuantity" :disabled="busy || !canSetQuantity(line)" :aria-invalid="!!inputErrors[line.id]" :aria-describedby="inputErrors[line.id] ? `quantity-error-${line.id}` : canSetQuantity(line) ? `quantity-hint-${line.id}` : undefined" class="min-h-11 w-24 rounded-sm border border-border bg-surface px-3 py-2 text-ink disabled:bg-off-soft disabled:text-off" @input="limit(line, $event.target.value)"><UiButton variant="secondary" :disabled="busy || !canSetQuantity(line) || line.quantity >= line.maxQuantity" :aria-label="`Agregar una pieza de ${line.name}`" @click="edit(line.id, line.quantity + 1)">+</UiButton><UiButton type="submit" variant="secondary" :disabled="busy || !canSetQuantity(line)">Actualizar</UiButton><UiButton variant="secondary" :disabled="busy" :aria-label="`Quitar ${line.name} del carrito`" @click="edit(line.id, 0, true)">Quitar</UiButton></div>
          <p v-if="inputErrors[line.id]" :id="`quantity-error-${line.id}`" role="alert" class="mt-2 text-body-s text-crit">{{ inputErrors[line.id] }}</p>
          <p v-else-if="canSetQuantity(line)" :id="`quantity-hint-${line.id}`" class="mt-2 text-body-s text-ink-2">Máximo: {{ line.maxQuantity }} piezas.</p>
        </form>
      </li></ul>
      <div class="mt-4 flex flex-wrap gap-2"><UiButton v-for="line in data.lines" :key="line.id" variant="secondary" :disabled="busy" @click="move(line.id, 'SAVE')">Guardar {{ line.name }} · {{ line.presentation }} para después</UiButton></div>
      <ShippingProgress :base-cents="data.totals.goodsAfterCouponCents" />
      <form class="mt-6 flex flex-wrap items-end gap-3" @submit.prevent="applyCoupon(code)"><UiField id="cart-coupon" v-model="code" label="Código de cupón" maxlength="60" autocomplete="off" :disabled="busy" /><UiButton type="submit" variant="secondary" :disabled="busy">Aplicar cupón</UiButton><UiButton v-if="data.coupon || data.couponError" variant="secondary" :disabled="busy" @click="applyCoupon('', true)">Retirar cupón</UiButton></form>
      <p v-if="data.coupon" class="mt-3 text-body-s text-ok">{{ data.coupon.code }} · Descuento {{ formatMXN(data.totals.couponDiscountCents) }}<span v-if="data.coupon.customerLimitPending"> · Límite por cliente pendiente de validar con correo al iniciar pago.</span></p><p v-if="data.couponError" role="alert" class="mt-3 text-body-s text-crit">{{ data.couponError }} No se aplicó descuento; revisa tu total.</p>
      <ShippingCalculator :version="data.version" :disabled="busy || data.lines.some(l => !l.stockSufficient)" />
      <UiButton v-if="quote && !data.lines.some(l => !l.stockSufficient)" class="mt-4" to="/checkout">Continuar con la compra</UiButton>
      <p class="mt-6 font-mono font-semibold" role="status">Total provisional{{ quote ? ' con envío seleccionado' : ' de productos' }}: {{ formatMXN(total) }}</p><p class="mt-2 text-ink-2">{{ quote ? 'La tarifa seleccionada se volverá a validar antes de pagar.' : 'Envío pendiente de cotizar; puede aumentar el total.' }} Los puntos se calcularán cuando estén habilitados. Precio y stock se verifican al recuperar el carrito; lote y caducidad se asignarán al iniciar pago.</p>
      <div class="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface p-4 lg:hidden" aria-label="Resumen del carrito móvil"><div><p class="font-mono font-semibold">Provisional {{ formatMXN(total) }}</p><p class="text-body-s">{{ data.pieces }} piezas · {{ quote ? 'Envío seleccionado' : 'Envío pendiente' }}</p></div><UiButton v-if="quote && !data.lines.some(l => !l.stockSufficient)" to="/checkout">Continuar con la compra</UiButton><UiButton v-else disabled>Selecciona un envío</UiButton></div>
    </template>
    <div v-else class="mt-6"><p>Tu carrito está vacío.</p><UiButton class="mt-4" to="/catalogo">Explorar catálogo</UiButton></div>
    <section v-if="!error && status !== 'pending' && data?.saved.length" class="mt-10" aria-label="Guardados para después"><h2 class="text-display-m font-bold">Guardado para después</h2><p class="mt-2 text-ink-2">Estos productos no cuentan para piezas, total, envío gratis ni puntos y no reservan stock.</p><ul class="mt-4 space-y-4"><li v-for="line in data.saved" :key="line.id" class="rounded-sm border border-line bg-surface p-4"><h3 class="font-semibold">{{ line.name }}</h3><p>{{ line.presentation }} · SKU {{ line.sku }} · {{ line.quantity }} piezas · {{ formatMXN(line.unitPriceCents) }} por pieza</p><p v-if="!line.valid || line.availableQty < line.quantity" class="mt-2 text-off">Presentación no disponible o cantidad superior al stock actual. Los avisos de reposición están pendientes de habilitar.</p><div class="mt-3 flex flex-wrap gap-2"><UiButton :disabled="busy || !line.valid || line.availableQty < line.quantity" @click="move(line.id, 'RESTORE')">Mover al carrito</UiButton><UiButton variant="secondary" :disabled="busy" @click="move(line.id, 'REMOVE')">Quitar guardado</UiButton><UiButton v-if="line.productId" variant="secondary" :to="{ path: `/producto/${line.productId}`, query: { variante: line.variantId } }">Ver producto</UiButton></div></li></ul></section>
    <ConfiguredRecommendations v-if="data?.lines.length" :source-ids="[...new Set(data.lines.flatMap(l => l.bundle ? l.bundle.components.map(c => c.productId) : [l.productId]).filter(Boolean))]" :excluded-variant-ids="[...new Set(data.lines.flatMap(l => l.bundle ? l.bundle.components.map(c => c.variantId) : [l.variantId]).filter(Boolean))]" kind="CROSS_SELL" />
    <ConfiguredBundles />
    <RestockForm v-for="line in data?.saved.filter(l => l.valid && l.variantId && l.availableQty === 0) ?? []" :key="`saved-restock-${line.id}`" :variant-id="line.variantId" :sku="line.sku" :presentation="line.presentation" />
  </section>
</template>
