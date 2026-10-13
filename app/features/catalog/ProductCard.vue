<script setup>
import { variantPricing } from '~~/shared/features/pricing/prices.js'
import CardPackshot from './CardPackshot.vue'
import { expiryLabel } from '~~/shared/features/inventory/lots.js'
import { useCart } from '../cart/useCart.js'
import RestockForm from '../restock/RestockForm.vue'
const cart = await useCart()
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
    <RestockForm v-if="product.variants[0]?.availableQty === 0" :variant-id="product.variants[0].id" :sku="product.variants[0].sku" :presentation="`${product.variants[0].presentationLabel} · ${product.variants[0].flavor}`" />
    <template #actions><div class="flex flex-wrap gap-2"><UiButton :to="`/producto/${product.id}`" variant="secondary">Ver producto</UiButton><UiButton :disabled="cart.busy.value || !product.variants[0]?.availableQty" @click="cart.add(product.variants[0].id, 1)">Agregar {{ product.variants[0]?.presentationLabel }} · {{ product.variants[0]?.flavor }}</UiButton></div></template>
  </UiCard>
</template>
