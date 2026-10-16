<script setup>
import ProductCard from './ProductCard.vue'
import CatalogFilters from './CatalogFilters.vue'
import { useCatalogFilters } from './useCatalogFilters.js'
import { filterKeys } from '~~/shared/features/catalog/filters.js'
import { catalogOrders } from '~~/shared/features/catalog/pagination.js'
const route = useRoute()
const query = computed(() => Object.fromEntries(['q', 'orden', 'pagina', ...filterKeys].filter(key => route.query[key] != null).map(key => [key, route.query[key]])))
const { data, status, error, refresh } = await useFetch('/api/catalog/products', { query })
const filters = useCatalogFilters(computed(() => data.value?.options ?? {}), computed(() => status.value === 'pending'))
const order = computed({ get: () => typeof route.query.orden === 'string' ? route.query.orden : 'relevancia', set: value => { const next = { ...route.query, orden: value }; delete next.pagina; navigateTo({ path: '/catalogo', query: next }) } })
const pageLink = page => ({ path: '/catalogo', query: { ...route.query, pagina: String(page) } })
const pageNumbers = computed(() => { const current = data.value?.page ?? 1, last = data.value?.pages ?? 0; return [...new Set([1, current - 1, current, current + 1, last])].filter(n => n >= 1 && n <= last).sort((a, b) => a - b) })
watch(() => data.value?.page, page => {
  if (!page || !route.query.pagina || error.value || status.value === 'pending') return
  const raw = route.query.pagina
  if (raw !== String(page)) navigateTo(pageLink(page), { replace: true })
}, { immediate: true })
function clearSearch(resetOrder = false) {
  const next = { ...route.query }; ['q', 'pagina', ...filterKeys].forEach(key => { delete next[key] })
  if (resetOrder === true) delete next.orden
  navigateTo({ path: '/catalogo', query: next })
}
</script>
<template>
  <div :aria-busy="status === 'pending'">
    <p v-if="data && !error" class="mt-2 font-mono text-body-s tracking-wide text-ink-2">{{ data.total }} {{ data.total === 1 ? 'producto' : 'productos' }}</p>
    <div class="mb-6 mt-8 flex flex-wrap items-center justify-between gap-4">
      <p class="font-mono text-body-s text-ink-2" role="status">{{ status === 'pending' ? 'Cargando resultados…' : data && !error ? `Mostrando ${data.start}–${data.end} de ${data.total}` : 'Resultados no disponibles' }}</p>
      <div class="flex w-full flex-wrap items-center gap-3 sm:w-auto"><label for="catalog-order" class="font-mono text-label uppercase tracking-widest text-ink-2">Ordenar por</label><select id="catalog-order" v-model="order" :disabled="status === 'pending'" class="min-h-11 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body-s text-ink sm:w-64"><option v-for="item in catalogOrders" :key="item.value" :value="item.value">{{ item.label }}</option></select></div>
    </div>
    <div class="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
    <CatalogFilters :filters="filters" />
    <div class="min-w-0">
    <div v-if="filters.chips.length" class="mb-10 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
      <span class="mr-1 font-mono text-label uppercase tracking-widest text-ink-2">Filtros activos</span>
      <button v-for="chip in filters.chips" :key="`${chip.key}:${chip.value}`" type="button" :disabled="filters.pending" :aria-label="`Quitar filtro ${chip.label}`" class="inline-flex min-h-11 items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2 text-body-s disabled:opacity-50" @click="filters.remove(chip)">{{ chip.label }}<span aria-hidden="true" class="text-ink-2">×</span></button>
      <button type="button" :disabled="filters.pending" class="min-h-11 px-2 text-body-s text-accent-text underline" @click="filters.clear">Limpiar filtros</button>
    </div>
    <UiLoading v-if="status === 'pending'" label="Cargando productos…" />
    <div v-else-if="error" role="alert" class="rounded-sm border border-border bg-crit-soft p-6 text-crit">
      <template v-if="error.statusCode === 400"><p>La búsqueda o los filtros de esta dirección no son válidos.</p><UiButton class="mt-4" variant="secondary" @click="clearSearch(true)">Limpiar búsqueda y filtros</UiButton></template>
      <template v-else><p>No pudimos cargar el catálogo. Intenta de nuevo.</p><UiButton class="mt-4" variant="secondary" :disabled="status === 'pending'" @click="refresh()">Reintentar</UiButton></template>
    </div>
    <div v-else-if="!data?.products?.length" class="rounded-sm border border-line bg-surface p-6 text-ink-2" role="status"><p>{{ data?.catalogTotal === 0 ? 'Todavía no hay productos publicados.' : 'No encontramos productos con esta búsqueda y filtros.' }}</p><UiButton v-if="data?.catalogTotal" class="mt-4" variant="secondary" @click="clearSearch">Limpiar búsqueda y filtros</UiButton></div>
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-catalog-grid><ProductCard v-for="product in data.products" :key="product.id" :product="product" /></div>
      <nav v-if="data.pages > 1" aria-label="Paginación del catálogo" class="mt-12 flex flex-wrap items-center justify-center gap-2">
        <UiButton :to="data.page > 1 ? pageLink(data.page - 1) : undefined" :disabled="data.page <= 1" variant="secondary">Anterior</UiButton>
        <NuxtLink v-for="page in pageNumbers" :key="page" :to="pageLink(page)" :aria-current="page === data.page ? 'page' : undefined" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border px-3 font-mono text-body-s" :class="page === data.page ? 'bg-ink text-on-ink' : 'bg-surface text-ink'">{{ page }}</NuxtLink>
        <UiButton :to="data.page < data.pages ? pageLink(data.page + 1) : undefined" :disabled="data.page >= data.pages" variant="secondary">Siguiente</UiButton>
      </nav>
    </template>
    </div>
    </div>
  </div>
</template>
