<script setup>
import { variantPricing } from '~~/shared/features/pricing/prices.js'
const props = defineProps({ product: { type: Object, required: true } })
const image = computed(() => props.product.images.find(i => i.kind === 'FRONT'))
const pricing = computed(() => props.product.variants[0] ? variantPricing(props.product.variants[0]) : null)
</script>
<template>
  <UiCard :title="product.name" :to="`/producto/${product.id}`" :image="image?.url" :image-alt="image?.alt">
    <p v-if="product.brand" class="text-body-s text-ink-2">{{ product.brand.name }}</p>
    <p v-if="pricing" class="mt-2 font-mono text-data-l font-semibold tabular-nums"><span v-if="product.variants.length > 1" class="text-body-s">Desde </span>{{ pricing.priceLabel }}</p>
    <p v-if="pricing?.compareAtPriceLabel" class="mt-1 text-body-s text-ink-2">Precio anterior: <s>{{ pricing.compareAtPriceLabel }}</s></p>
    <p v-if="pricing?.servingCostLabel" class="mt-2 font-mono text-body-s tabular-nums">{{ pricing.servingCostLabel }}</p>
    <template #actions><UiButton :to="`/producto/${product.id}`" variant="secondary">Ver producto</UiButton></template>
  </UiCard>
</template>
