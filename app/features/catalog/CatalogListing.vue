<script setup>
import ProductCard from './ProductCard.vue'
import CatalogFilters from './CatalogFilters.vue'
import { filterKeys } from '~~/shared/features/catalog/filters.js'
import { catalogOrders } from '~~/shared/features/catalog/pagination.js'
const route = useRoute()
const query = computed(() => Object.fromEntries(['q', 'orden', 'pagina', ...filterKeys].filter(key => route.query[key] != null).map(key => [key, route.query[key]])))
const { data, status, error, refresh } = await useFetch('/api/catalog/products', { query })
const order = computed({ get: () => typeof route.query.orden === 'string' ? route.query.orden : 'relevancia', set: value => { const next = { ...route.query, orden: value }; delete next.pagina; navigateTo({ path: '/catalogo', query: next }) } })
const pageLink = page => ({ path: '/catalogo', query: { ...route.query, pagina: String(page) } })
const pageNumbers = computed(() => { const current = data.value?.page ?? 1, last = data.value?.pages ?? 0; return [...new Set([1, current - 1, current, current + 1, last])].filter(n => n >= 1 && n <= last).sort((a, b) => a - b) })
watch(() => data.value?.page, page => {
  if (!page || !route.query.pagina || error.value || status.value === 'pending') return
  const raw = route.query.pagina
  if (raw !== String(page)) navigateTo(pageLink(page), { replace: true })
}, { immediate: true })
function clearSearch() {
  const next = { ...route.query }; ['q', 'pagina', ...filterKeys].forEach(key => { delete next[key] })
  navigateTo({ path: '/catalogo', query: next })
}
</script>
<template>
  <div class="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]" :aria-busy="status === 'pending'">
    <CatalogFilters :options="data?.options" :pending="status === 'pending'" />
    <div class="min-w-0">
    <UiField id="catalog-order" v-model="order" label="Ordenar por" :options="catalogOrders" :disabled="status === 'pending'" class="mb-6 max-w-sm" />
    <p v-if="status === 'pending'" role="status" class="text-ink-2">Cargando productos…</p>
    <div v-else-if="error" role="alert" class="rounded-sm border border-border bg-crit-soft p-6 text-crit">
      <p>No pudimos cargar el catálogo. Intenta de nuevo.</p><UiButton class="mt-4" variant="secondary" @click="refresh()">Reintentar</UiButton>
    </div>
    <div v-else-if="!data?.products?.length" class="rounded-sm border border-line bg-surface p-6 text-ink-2" role="status"><p>{{ data?.catalogTotal === 0 ? 'Todavía no hay productos publicados.' : 'No encontramos productos con esta búsqueda y filtros.' }}</p><UiButton v-if="data?.catalogTotal" class="mt-4" variant="secondary" @click="clearSearch">Limpiar búsqueda y filtros</UiButton></div>
    <template v-else>
      <p class="mb-4 font-mono text-body-s" role="status">{{ data.start }}–{{ data.end }} de {{ data.total }} resultados</p>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><ProductCard v-for="product in data.products" :key="product.id" :product="product" /></div>
      <nav v-if="data.pages > 1" aria-label="Paginación del catálogo" class="mt-8 flex flex-wrap items-center gap-2">
        <UiButton :to="data.page > 1 ? pageLink(data.page - 1) : undefined" :disabled="data.page <= 1" variant="secondary">Anterior</UiButton>
        <NuxtLink v-for="page in pageNumbers" :key="page" :to="pageLink(page)" :aria-current="page === data.page ? 'page' : undefined" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border px-3" :class="page === data.page ? 'bg-accent text-accent-ink' : 'bg-surface text-ink'">{{ page }}</NuxtLink>
        <UiButton :to="data.page < data.pages ? pageLink(data.page + 1) : undefined" :disabled="data.page >= data.pages" variant="secondary">Siguiente</UiButton>
      </nav>
    </template>
    </div>
  </div>
</template>
