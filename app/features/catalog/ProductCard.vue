<script setup>
import { variantPricing } from '~~/shared/features/pricing/prices.js'
import CardPackshot from './CardPackshot.vue'
import { expiryLabel } from '~~/shared/features/inventory/lots.js'
import { useCart } from '../cart/useCart.js'
import RestockForm from '../restock/RestockForm.vue'
const cart = await useCart()
const props = defineProps({ product: { type: Object, required: true } })
const variant = computed(() => props.product.variants[0])
const pricing = computed(() => variant.value ? variantPricing(variant.value) : null)
const lot = computed(() => variant.value?.lots?.[0])
const available = computed(() => (variant.value?.availableQty ?? 0) > 0)
const productPath = computed(() => ({ path: `/producto/${props.product.id}`, query: variant.value ? { variante: variant.value.id } : {} }))
</script>
<template>
  <article class="relative isolate flex h-full min-w-0 flex-col overflow-hidden rounded-sm border border-line bg-surface [overflow-wrap:anywhere]" data-product-card>
    <div class="relative">
      <CardPackshot :images="product.images" :variant-id="variant?.id" :to="productPath" :product-name="product.name" />
      <span v-if="lot?.origin" class="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-24px)] rounded-sm bg-accent-soft px-2 py-1 font-mono text-label font-semibold uppercase tracking-wider text-accent-text">{{ lot.importedOn ? 'Importado · ' : 'Origen · ' }}{{ lot.origin }}</span>
    </div>
    <div class="flex flex-1 flex-col p-4">
      <h3 class="font-display text-display-m font-bold uppercase leading-tight"><NuxtLink :to="productPath" class="after:absolute after:inset-0 hover:text-accent-text hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink">{{ product.name }}</NuxtLink></h3>
      <p v-if="product.brand" class="mt-1 text-body-s text-ink-2">{{ product.brand.name }}</p>
      <p v-if="variant" class="mt-2 font-mono text-label uppercase leading-relaxed text-ink-2">SKU {{ variant.sku }}<template v-if="lot"> · Lote {{ lot.lotCode }} · CAD {{ expiryLabel(lot) }}</template></p>
      <p v-if="lot" class="mt-1 text-label text-ink-2">Lote orientativo; se confirma al reservar.</p>
      <p class="mt-3 flex items-center gap-2 rounded-pill px-3 py-1 text-body-s font-semibold" :class="available ? 'bg-ok-soft text-ok' : 'bg-off-soft text-off'"><span class="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />{{ available ? variant.availableQty <= 5 ? `En stock · Últimas ${variant.availableQty} piezas` : 'En stock' : product.variants.length > 1 ? 'Presentación mostrada agotada' : 'Agotado por el momento' }}</p>
      <div v-if="pricing" class="mt-4">
        <p class="flex flex-wrap items-baseline gap-x-2 font-mono tabular-nums"><span v-if="product.variants.length > 1" class="text-body-s text-ink-2">Desde</span><span class="text-data-l font-semibold">{{ pricing.priceLabel.replace(' MXN', '') }}</span><span class="text-label text-ink-2">MXN</span></p>
        <p v-if="pricing.compareAtPriceLabel" class="mt-1 text-body-s text-ink-2">Antes: <s>{{ pricing.compareAtPriceLabel }}</s></p>
      </div>
      <p v-if="pricing?.servingCostLabel" class="mt-3 font-mono text-label leading-relaxed text-ink-2">{{ pricing.servingCostLabel.replace(' MXN', '') }} · {{ variant.servings }} porciones<template v-if="variant.servingAmount && variant.servingUnit"> · {{ variant.servingAmount }} {{ variant.servingUnit }}</template></p>
      <div class="relative z-10 mt-auto pt-4">
        <UiButton v-if="available" class="w-full" :disabled="cart.busy.value" :aria-label="`Agregar ${product.name} al carrito${variant ? `, ${variant.presentationLabel}, ${variant.flavor}` : ''}`" @click="cart.add(variant.id, 1)">Agregar al carrito</UiButton>
        <RestockForm v-else-if="variant" compact :variant-id="variant.id" :sku="variant.sku" :presentation="`${variant.presentationLabel} · ${variant.flavor}`" />
        <UiButton v-else class="w-full" disabled>Sin existencias</UiButton>
      </div>
    </div>
  </article>
</template>
