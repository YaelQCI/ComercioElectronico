<script setup>
import { storeCategories } from '~/utils/navigation'
import CatalogListing from '~/features/catalog/CatalogListing.vue'
const route = useRoute()
const category = computed(() => storeCategories.find(item => item.slug === route.query.categoria))
const crumbs = computed(() => category.value ? [{ label: 'Catálogo', to: '/catalogo' }, { label: category.value.name }] : [{ label: 'Catálogo' }])
useHead({ title: 'Catálogo — The Fitness Stuff' })
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-12 md:px-8">
    <UiBreadcrumbs :items="crumbs" />
    <h1 class="text-display-l font-bold">{{ category?.name || 'Catálogo' }}</h1>
    <p v-if="route.query.q" class="mt-3 text-ink-2">Búsqueda: {{ route.query.q }}</p>
    <p v-if="route.query.categoria" class="mt-3 text-body-s text-ink-2">El filtro de categoría aún no está disponible.</p>
    <CatalogListing />
    <div class="mt-6"><UiButton to="/" variant="secondary">Volver al inicio</UiButton></div>
  </section>
</template>
