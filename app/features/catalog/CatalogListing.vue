<script setup>
import ProductCard from './ProductCard.vue'
import CatalogFilters from './CatalogFilters.vue'
import { filterKeys } from '~~/shared/features/catalog/filters.js'
const route = useRoute()
const query = computed(() => Object.fromEntries(['q', ...filterKeys].filter(key => route.query[key] != null).map(key => [key, route.query[key]])))
const { data, status, error, refresh } = await useFetch('/api/catalog/products', { query })
function clearSearch() {
  const next = { ...route.query }; ['q', 'pagina', ...filterKeys].forEach(key => { delete next[key] })
  navigateTo({ path: '/catalogo', query: next })
}
</script>
<template>
  <div class="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]" :aria-busy="status === 'pending'">
    <CatalogFilters :options="data?.options" :pending="status === 'pending'" />
    <div class="min-w-0">
    <p v-if="status === 'pending'" role="status" class="text-ink-2">Cargando productos…</p>
    <div v-else-if="error" role="alert" class="rounded-sm border border-border bg-crit-soft p-6 text-crit">
      <p>No pudimos cargar el catálogo. Intenta de nuevo.</p><UiButton class="mt-4" variant="secondary" @click="refresh()">Reintentar</UiButton>
    </div>
    <div v-else-if="!data?.products?.length" class="rounded-sm border border-line bg-surface p-6 text-ink-2" role="status"><p>{{ data?.catalogTotal === 0 ? 'Todavía no hay productos publicados.' : 'No encontramos productos con esta búsqueda y filtros.' }}</p><UiButton v-if="data?.catalogTotal" class="mt-4" variant="secondary" @click="clearSearch">Limpiar búsqueda y filtros</UiButton></div>
    <template v-else><p class="mb-4 font-mono text-body-s" role="status">{{ data.products.length }} resultados</p><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><ProductCard v-for="product in data.products" :key="product.id" :product="product" /></div></template>
    </div>
  </div>
</template>
