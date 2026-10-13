<script setup>
import ProductCard from './ProductCard.vue'
const props = defineProps({ sourceIds: { type: Array, required: true }, kind: { type: String, required: true }, excludedVariantIds: { type: Array, default: () => [] } })
const query = computed(() => ({ source: props.sourceIds.join(','), kind: props.kind, exclude: props.excludedVariantIds.join(',') }))
const { data, error, status, refresh } = await useFetch('/api/catalog/recommendations', { query })
</script>
<template><section v-if="sourceIds.length && (error || status === 'pending' || data?.products.length)" class="mt-10" aria-label="Productos relacionados configurados"><h2 class="text-display-m font-bold">{{ kind === 'RELATED' ? 'También te puede servir' : 'Súmalo a tu pedido' }}</h2><UiLoading v-if="status === 'pending'" label="Cargando relacionados…" :cards="2" /><div v-else-if="error" class="mt-3"><p>No pudimos cargar los relacionados.</p><UiButton variant="secondary" @click="refresh()">Reintentar</UiButton></div><div v-else class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><ProductCard v-for="product in data.products" :key="product.id" :product="product" /></div></section></template>
