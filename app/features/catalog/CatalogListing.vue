<script setup>
import ProductCard from './ProductCard.vue'
const { data, status, error, refresh } = await useFetch('/api/catalog/products')
</script>
<template>
  <div class="mt-6" :aria-busy="status === 'pending'">
    <p v-if="status === 'pending'" role="status" class="text-ink-2">Cargando productos…</p>
    <div v-else-if="error" role="alert" class="rounded-sm border border-border bg-crit-soft p-6 text-crit">
      <p>No pudimos cargar el catálogo. Intenta de nuevo.</p><UiButton class="mt-4" variant="secondary" @click="refresh()">Reintentar</UiButton>
    </div>
    <p v-else-if="!data?.products?.length" class="rounded-sm border border-line bg-surface p-6 text-ink-2">Todavía no hay productos publicados.</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><ProductCard v-for="product in data.products" :key="product.id" :product="product" /></div>
  </div>
</template>
