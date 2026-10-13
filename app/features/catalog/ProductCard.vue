<script setup>
import { variantPricing } from '~~/shared/features/pricing/prices.js'
import CardPackshot from './CardPackshot.vue'
import { expiryLabel } from '~~/shared/features/inventory/lots.js'
const props = defineProps({ product: { type: Object, required: true } })
const pricing = computed(() => props.product.variants[0] ? variantPricing(props.product.variants[0]) : null)
</script>
<template>
  <UiCard :title="product.name" :to="`/producto/${product.id}`">
    <template #image><CardPackshot :images="product.images" :variant-id="product.variants[0]?.id" /></template>
    <p v-if="product.brand" class="text-body-s text-ink-2">{{ product.brand.name }}</p>
    <p v-if="pricing" class="mt-2 font-mono text-data-l font-semibold tabular-nums"><span v-if="product.variants.length > 1" class="text-body-s">Desde </span>{{ pricing.priceLabel }}</p>
    <p v-if="pricing?.compareAtPriceLabel" class="mt-1 text-body-s text-ink-2">Precio anterior: <s>{{ pricing.compareAtPriceLabel }}</s></p>
    <p v-if="pricing?.servingCostLabel" class="mt-2 font-mono text-body-s tabular-nums">{{ pricing.servingCostLabel }}</p>
    <p v-if="product.variants[0]" class="mt-2 font-mono text-body-s text-ink-2">SKU {{ product.variants[0].sku }}</p>
    <p v-if="product.variants[0]?.lots?.[0]" class="mt-2 font-mono text-body-s text-ink-2">Lote orientativo {{ product.variants[0].lots[0].lotCode }} · CAD {{ expiryLabel(product.variants[0].lots[0]) }}</p>
    <p v-if="product.variants[0]" class="mt-2 text-body-s" :class="product.variants[0].availableQty ? 'text-ok' : 'text-off'">{{ product.variants[0].availableQty === 0 ? 'Presentación mostrada agotada' : product.variants[0].availableQty <= 5 ? `Últimas ${product.variants[0].availableQty} piezas` : 'Disponible' }}</p>
    <template #actions><UiButton :to="`/producto/${product.id}`" variant="secondary">Ver producto</UiButton></template>
  </UiCard>
</template>
