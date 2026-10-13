<script setup>
import { comparePresentations, variantPricing, formatMXN } from '~~/shared/features/pricing/prices.js'
import { selectedVariant, productQuantity, nutritionRows } from '~~/shared/features/catalog/product-selection.js'
import ProductGallery from './ProductGallery.vue'
const props = defineProps({ id: { type: String, required: true } })
const { data, status, error, refresh } = await useFetch(() => `/api/catalog/products/${props.id}`)
if ([400, 404].includes(error.value?.statusCode)) throw createError({ statusCode: 404, statusMessage: 'Producto no disponible.' })
const product = computed(() => data.value?.product)
const route = useRoute()
const variant = computed(() => selectedVariant(product.value, route.query.variante))
const variantId = computed(() => variant.value?.id ?? '')
const quantity = ref('1')
watch(variantId, () => { quantity.value = '1' })
function chooseVariant(id) { navigateTo({ path: route.path, query: { ...route.query, variante: id } }) }
const flavors = computed(() => [...new Set(product.value?.variants.map(v => v.flavor) ?? [])].map(value => ({ value, label: value })))
const flavor = computed({ get: () => variant.value?.flavor ?? '', set: value => { const candidates = product.value?.variants.filter(v => v.flavor === value) ?? []; const next = candidates.find(v => v.presentationLabel === variant.value?.presentationLabel) ?? candidates[0]; if (next) chooseVariant(next.id) } })
const presentations = computed(() => product.value?.variants.filter(v => v.flavor === flavor.value).map(v => ({ value: v.presentationLabel, label: v.presentationLabel })) ?? [])
const presentation = computed({ get: () => variant.value?.presentationLabel ?? '', set: value => { const next = product.value?.variants.find(v => v.flavor === flavor.value && v.presentationLabel === value); if (next) chooseVariant(next.id) } })
const quantityError = computed(() => { if (!variant.value?.availableQty) return ''; try { productQuantity(quantity.value, variant.value.availableQty); return '' } catch { return 'Usa una cantidad entera entre 1 y las piezas disponibles.' } })
const nutrition = computed(() => nutritionRows(variant.value?.nutritionData))
const pricing = computed(() => variant.value ? variantPricing(variant.value) : null)
const rows = computed(() => comparePresentations(product.value?.variants ?? []))
const crumbs = computed(() => [{ label: 'Catálogo', to: '/catalogo' }, ...(product.value?.categories.find(c => c.isPrimary) ? [{ label: product.value.categories.find(c => c.isPrimary).name, to: { path: '/catalogo', query: { categoria: product.value.categories.find(c => c.isPrimary).slug } } }] : []), { label: product.value?.name ?? 'Producto' }])
useHead(() => ({ title: `${product.value?.name ?? 'Producto'} — The Fitness Stuff` }))
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-8 md:px-8" :aria-busy="status === 'pending'">
    <UiBreadcrumbs :items="crumbs" />
    <UiLoading v-if="status === 'pending'" label="Cargando producto…" :cards="1" />
    <div v-else-if="error" role="alert"><h1 class="text-display-l font-bold">Producto no disponible</h1><p class="mt-4">No pudimos cargar el producto.</p><UiButton class="mt-4" @click="refresh()">Reintentar</UiButton></div>
    <template v-else-if="product">
      <div class="grid gap-8 md:grid-cols-2">
        <ProductGallery :images="product.images" :variant-id="variantId" />
        <div>
          <p v-if="product.brand" class="font-mono text-label uppercase text-ink-2">{{ product.brand.name }}</p>
          <h1 class="mt-2 text-display-l font-bold">{{ product.name }}</h1>
          <p class="mt-4 whitespace-pre-line">{{ product.description }}</p>
          <p v-if="!variant" role="alert" class="mt-6 text-crit">Esta presentación no está disponible. <NuxtLink :to="route.path" class="underline">Ver presentaciones disponibles</NuxtLink></p>
          <UiField v-if="variant" id="flavor" v-model="flavor" label="Sabor" class="mt-6" :options="flavors" />
          <UiField v-if="variant" id="presentation" v-model="presentation" label="Presentación" class="mt-4" :options="presentations" />
          <template v-if="variant && pricing">
            <p class="mt-3 font-mono text-body-s text-ink-2">SKU {{ variant.sku }}</p>
            <p class="mt-4 font-mono text-data-l font-semibold tabular-nums">{{ pricing.priceLabel }}</p>
            <p v-if="pricing.compareAtPriceLabel" class="mt-1 text-body-s text-ink-2">Precio anterior: <s>{{ pricing.compareAtPriceLabel }}</s></p>
            <p v-if="pricing.servingCostLabel" class="mt-2 font-mono text-body-s tabular-nums">{{ pricing.servingCostLabel }} · {{ variant.servings }} porciones</p>
            <p class="mt-3 text-body-s" :class="variant.availableQty ? 'text-ok' : 'text-off'">{{ variant.availableQty === 0 ? 'Agotado' : variant.availableQty <= 5 ? `Últimas ${variant.availableQty} piezas` : `${variant.availableQty} piezas disponibles` }}</p>
            <UiField id="product-quantity" v-model="quantity" label="Cantidad" type="number" min="1" step="1" :max="Math.max(1, variant.availableQty)" :disabled="!variant.availableQty" :error="quantityError" class="mt-4 max-w-40" />
          </template>
          <UiButton class="mt-6" disabled>Compra no habilitada</UiButton>
          <p class="mt-2 text-body-s text-ink-2">Estamos preparando la compra en línea.</p>
        </div>
      </div>
      <section v-if="rows.length" class="mt-10" aria-label="Comparación de presentaciones">
        <UiTable caption="Costo por porción de las presentaciones" :columns="[{ key: 'presentationLabel', label: 'Presentación' }, { key: 'flavor', label: 'Sabor' }, { key: 'priceLabel', label: 'Precio vigente', numeric: true }, { key: 'servingCostLabel', label: 'Costo por porción', numeric: true }, { key: 'isBest', label: 'Comparación' }]" :rows="rows">
          <template #servingCostLabel="{ value }">{{ value ?? 'Porciones no documentadas' }}</template>
          <template #isBest="{ row }"><span v-if="row.isBest" class="font-semibold text-ok">Menor costo por porción</span><span v-else-if="row.savingPerServingCents !== null">Diferencia por porción: {{ formatMXN(row.savingPerServingCents) }}</span><span v-else>No comparable</span></template>
        </UiTable>
      </section>
      <section class="mt-10 space-y-4" aria-label="Información del producto">
        <details class="rounded-sm border border-line bg-surface p-4"><summary class="min-h-11 cursor-pointer py-3 font-semibold">Descripción</summary><p class="mt-2 whitespace-pre-line">{{ product.description }}</p></details>
        <details v-if="product.ingredients" class="rounded-sm border border-line bg-surface p-4"><summary class="min-h-11 cursor-pointer py-3 font-semibold">Ingredientes</summary><p class="mt-2 whitespace-pre-line">{{ product.ingredients }}</p></details>
        <details v-if="product.allergenInformation" class="rounded-sm border border-line bg-surface p-4"><summary class="min-h-11 cursor-pointer py-3 font-semibold">Alérgenos</summary><p class="mt-2 whitespace-pre-line">{{ product.allergenInformation }}</p></details>
        <details v-if="product.usageInstructions" class="rounded-sm border border-line bg-surface p-4"><summary class="min-h-11 cursor-pointer py-3 font-semibold">Modo de uso</summary><p class="mt-2 whitespace-pre-line">{{ product.usageInstructions }}</p></details>
        <details class="rounded-sm border border-line bg-surface p-4"><summary class="min-h-11 cursor-pointer py-3 font-semibold">Envíos y devoluciones</summary><p class="mt-2">Las condiciones comerciales aún no están publicadas.</p><NuxtLink to="/politicas/devoluciones" class="mt-3 inline-flex min-h-11 items-center text-accent-text underline">Consultar devoluciones</NuxtLink></details>
        <UiTable v-if="nutrition.length" caption="Información nutrimental de la presentación seleccionada" :columns="[{ key: 'nutrient', label: 'Nutrimento' }, { key: 'amount', label: 'Cantidad declarada', numeric: true }]" :rows="nutrition" />
      </section>
      <div v-if="variant && pricing" class="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface p-4 lg:hidden" aria-label="Resumen de compra móvil">
        <div><p class="font-mono text-body-s tabular-nums">{{ pricing.priceLabel }}</p><p class="text-body-s text-ink-2">{{ variant.presentationLabel }} · {{ variant.flavor }} · Cantidad {{ quantity }}</p></div><UiButton disabled>Compra no habilitada</UiButton>
      </div>
    </template>
  </section>
</template>
