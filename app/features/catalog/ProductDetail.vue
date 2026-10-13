<script setup>
import { comparePresentations, variantPricing, formatMXN } from '~~/shared/features/pricing/prices.js'
const props = defineProps({ id: { type: String, required: true } })
const { data, status, error, refresh } = await useFetch(() => `/api/catalog/products/${props.id}`)
if ([400, 404].includes(error.value?.statusCode)) throw createError({ statusCode: 404, statusMessage: 'Producto no disponible.' })
const product = computed(() => data.value?.product)
const variantId = ref('')
watch(() => product.value?.id, () => { variantId.value = product.value?.variants[0]?.id ?? '' }, { immediate: true })
const variant = computed(() => product.value?.variants.find(v => v.id === variantId.value))
const pricing = computed(() => variant.value ? variantPricing(variant.value) : null)
const image = computed(() => product.value?.images.find(i => i.kind === 'FRONT' && i.variantId === variantId.value) ?? product.value?.images.find(i => i.kind === 'FRONT' && !i.variantId))
const rows = computed(() => comparePresentations(product.value?.variants ?? []))
const crumbs = computed(() => [{ label: 'Catálogo', to: '/catalogo' }, ...(product.value?.categories.find(c => c.isPrimary) ? [{ label: product.value.categories.find(c => c.isPrimary).name, to: { path: '/catalogo', query: { categoria: product.value.categories.find(c => c.isPrimary).slug } } }] : []), { label: product.value?.name ?? 'Producto' }])
useHead(() => ({ title: `${product.value?.name ?? 'Producto'} — The Fitness Stuff` }))
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-8 md:px-8" :aria-busy="status === 'pending'">
    <UiBreadcrumbs :items="crumbs" />
    <p v-if="status === 'pending'" role="status">Cargando producto…</p>
    <div v-else-if="error" role="alert"><h1 class="text-display-l font-bold">Producto no disponible</h1><p class="mt-4">No pudimos cargar el producto.</p><UiButton class="mt-4" @click="refresh()">Reintentar</UiButton></div>
    <template v-else-if="product">
      <div class="grid gap-8 md:grid-cols-2">
        <div class="aspect-square rounded-sm border border-line bg-packshot p-6"><img v-if="image" :src="image.url" :alt="image.alt" width="600" height="600" class="h-full w-full object-contain"><p v-else class="text-packshot-ink-2">Imagen pendiente.</p></div>
        <div>
          <p v-if="product.brand" class="font-mono text-label uppercase text-ink-2">{{ product.brand.name }}</p>
          <h1 class="mt-2 text-display-l font-bold">{{ product.name }}</h1>
          <p class="mt-4 whitespace-pre-line">{{ product.description }}</p>
          <UiField v-if="product.variants.length" id="presentation" v-model="variantId" label="Presentación" class="mt-6" :options="product.variants.map(v => ({ value: v.id, label: `${v.presentationLabel} · ${v.flavor}` }))" />
          <template v-if="variant && pricing">
            <p class="mt-3 font-mono text-body-s text-ink-2">SKU {{ variant.sku }}</p>
            <p class="mt-4 font-mono text-data-l font-semibold tabular-nums">{{ pricing.priceLabel }}</p>
            <p v-if="pricing.compareAtPriceLabel" class="mt-1 text-body-s text-ink-2">Precio anterior: <s>{{ pricing.compareAtPriceLabel }}</s></p>
            <p v-if="pricing.servingCostLabel" class="mt-2 font-mono text-body-s tabular-nums">{{ pricing.servingCostLabel }} · {{ variant.servings }} porciones</p>
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
      <section v-if="product.ingredients || product.allergenInformation || product.usageInstructions" class="mt-10 space-y-4" aria-label="Información del producto">
        <div v-if="product.ingredients"><h2 class="font-display text-display-m font-bold">Ingredientes</h2><p class="mt-2 whitespace-pre-line">{{ product.ingredients }}</p></div>
        <div v-if="product.allergenInformation"><h2 class="font-display text-display-m font-bold">Alérgenos</h2><p class="mt-2 whitespace-pre-line">{{ product.allergenInformation }}</p></div>
        <div v-if="product.usageInstructions"><h2 class="font-display text-display-m font-bold">Modo de uso</h2><p class="mt-2 whitespace-pre-line">{{ product.usageInstructions }}</p></div>
      </section>
    </template>
  </section>
</template>
