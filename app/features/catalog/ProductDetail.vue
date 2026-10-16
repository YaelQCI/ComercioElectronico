<script setup>
import ProductReviews from '~/features/reviews/ProductReviews.vue'
import { variantPricing } from '~~/shared/features/pricing/prices.js'
import { selectedVariant, productQuantity } from '~~/shared/features/catalog/product-selection.js'
import ProductGallery from './ProductGallery.vue'
import ProductLots from './ProductLots.vue'
import ProductInformation from './ProductInformation.vue'
import ProductNutrition from './ProductNutrition.vue'
import ProductComparison from './ProductComparison.vue'
import RestockForm from '../restock/RestockForm.vue'
import ConfiguredRecommendations from './ConfiguredRecommendations.vue'
import { useCart } from '../cart/useCart.js'
const cart = await useCart()
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
const presentations = computed(() => product.value?.variants.filter(v => v.flavor === flavor.value).map(v => ({ ...v, pricing: variantPricing(v) })) ?? [])
function adjustQuantity(delta) {
  const current = Number(quantity.value)
  quantity.value = String(Math.max(1, Math.min(variant.value?.availableQty || 1, (Number.isSafeInteger(current) && current > 0 ? current : 1) + delta)))
}
const quantityError = computed(() => { if (!variant.value?.availableQty) return ''; try { productQuantity(quantity.value, variant.value.availableQty); return '' } catch { return 'Usa una cantidad entera entre 1 y las piezas disponibles.' } })
const pricing = computed(() => variant.value ? variantPricing(variant.value) : null)
const category = computed(() => product.value?.categories.find(item => item.isPrimary) ?? product.value?.categories[0])
const crumbs = computed(() => [{ label: 'Catálogo', to: '/catalogo' }, ...(product.value?.categories.find(c => c.isPrimary) ? [{ label: product.value.categories.find(c => c.isPrimary).name, to: { path: '/catalogo', query: { categoria: product.value.categories.find(c => c.isPrimary).slug } } }] : []), { label: product.value?.name ?? 'Producto' }])
useHead(() => ({ title: `${product.value?.name ?? 'Producto'} — The Fitness Stuff` }))
</script>
<template>
  <section class="mx-auto max-w-store px-4 pb-24 pt-8 md:px-8" :aria-busy="status === 'pending'">
    <UiBreadcrumbs :items="crumbs" />
    <UiLoading v-if="status === 'pending'" label="Cargando producto…" variant="product" />
    <div v-else-if="error" role="alert"><h1 class="text-display-l font-bold">Producto no disponible</h1><p class="mt-4">No pudimos cargar el producto.</p><UiButton class="mt-4" @click="refresh()">Reintentar</UiButton></div>
    <template v-else-if="product">
      <div class="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
        <ProductGallery :images="product.images" :variant-id="variantId" />
        <div>
          <p v-if="category" class="font-mono text-label font-semibold uppercase tracking-widest text-accent-text">{{ category.name }}</p>
          <h1 class="mt-3 font-display text-display-l font-bold uppercase leading-tight">{{ product.name }}</h1>
          <p v-if="product.brand" class="mt-2 text-body-s text-ink-2">{{ product.brand.name }}</p>
          <p v-if="!variant" role="alert" class="mt-6 text-crit">Esta presentación no está disponible. <NuxtLink :to="route.path" class="underline">Ver presentaciones disponibles</NuxtLink></p>
          <template v-if="variant && pricing">
            <div class="mt-5 flex flex-wrap items-baseline gap-3 font-mono tabular-nums"><p class="text-data-l font-semibold" data-product-price>{{ pricing.priceLabel }}</p><s v-if="pricing.compareAtPriceLabel" class="text-body-s text-ink-2">{{ pricing.compareAtPriceLabel }}</s></div>
            <p v-if="pricing.servingCostLabel" class="mt-3 font-mono text-label text-ink-2">{{ pricing.servingCostLabel }} · {{ variant.servings }} porciones<template v-if="variant.servingAmount && variant.servingUnit"> · {{ variant.servingAmount }} {{ variant.servingUnit }}</template></p>
            <p class="mt-4 flex items-center gap-2 rounded-pill px-3 py-1 text-body-s font-semibold" :class="variant.availableQty ? 'bg-ok-soft text-ok' : 'bg-off-soft text-off'"><span class="h-2 w-2 rounded-full bg-current" aria-hidden="true" />{{ variant.availableQty === 0 ? 'Agotado por el momento' : variant.availableQty <= 5 ? `En stock · Últimas ${variant.availableQty} piezas` : `En stock · ${variant.availableQty} piezas disponibles` }}</p>
            <UiField v-if="flavors.length > 1" id="flavor" v-model="flavor" label="Sabor" class="mt-5" :options="flavors" />
            <fieldset class="mt-5" aria-label="Presentación del producto"><legend class="mb-2 font-mono text-label uppercase tracking-widest text-ink-2">Presentación</legend><div class="flex flex-wrap gap-2"><button v-for="item in presentations" :key="item.id" type="button" :aria-pressed="item.id === variantId" class="min-h-16 min-w-24 rounded-sm border px-3 py-2 text-left" :class="item.id === variantId ? 'border-accent bg-accent-soft' : 'border-border bg-surface'" @click="chooseVariant(item.id)"><span class="block font-display text-display-m font-bold uppercase">{{ item.presentationLabel }}</span><span class="mt-1 block font-mono text-label text-ink-2">{{ (item.pricing.servingCostLabel ?? item.pricing.priceLabel).replace(' MXN', '') }}</span></button></div></fieldset>
            <div class="mt-5"><label for="product-quantity" class="mb-2 block font-mono text-label uppercase tracking-widest text-ink-2">Cantidad</label><div class="inline-flex items-stretch"><UiButton variant="secondary" aria-label="Disminuir cantidad" :disabled="cart.busy.value || !variant.availableQty || Number(quantity) <= 1" @click="adjustQuantity(-1)">−</UiButton><input id="product-quantity" v-model="quantity" type="number" min="1" step="1" :max="Math.max(1, variant.availableQty)" :disabled="cart.busy.value || !variant.availableQty" :aria-invalid="!!quantityError" :aria-describedby="quantityError ? 'product-quantity-error' : undefined" class="min-h-11 w-16 min-w-0 border-y border-border bg-surface px-2 text-center font-mono text-body-s"><UiButton variant="secondary" aria-label="Aumentar cantidad" :disabled="cart.busy.value || !variant.availableQty || Number(quantity) >= variant.availableQty" @click="adjustQuantity(1)">+</UiButton></div><p v-if="quantityError" id="product-quantity-error" role="alert" class="mt-2 text-body-s text-crit">{{ quantityError }}</p></div>
          </template>
          <div class="mt-5 grid gap-3" role="group" aria-label="Acciones de compra"><UiButton :disabled="cart.busy.value || !variant?.availableQty || !!quantityError" @click="cart.add(variantId, quantity)">Agregar al carrito</UiButton><UiButton variant="secondary" :disabled="cart.busy.value || !variant?.availableQty || !!quantityError" @click="cart.add(variantId, quantity, true)">Comprar ahora</UiButton></div>
          <RestockForm v-if="variant && variant.availableQty === 0" :key="variant.id" :variant-id="variant.id" :sku="variant.sku" :presentation="`${variant.presentationLabel} · ${variant.flavor}`" />
          <div class="mt-6 border-t border-line pt-4"><NuxtLink to="/#price-guarantee-heading" class="inline-flex min-h-11 items-center gap-3 text-body-s text-accent-text underline"><UiIcon name="tag" />¿Lo viste más barato? Consulta nuestra garantía de precio</NuxtLink><p class="mt-3 flex items-center gap-3 text-body-s text-ink-2"><UiIcon name="card" />Pago seguro con Stripe</p></div>
        </div>
      </div>
      <ProductLots v-if="variant" :variant="variant" />
      <ProductInformation :product="product" />
      <ProductNutrition v-if="variant" :variant="variant" />
      <ProductComparison :variants="product.variants" />
      <ProductReviews :key="product.id" :product-id="product.id" />
      <ConfiguredRecommendations :source-ids="[product.id]" kind="RELATED" prominent />
      <div v-if="variant && pricing" class="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface p-4 lg:hidden" aria-label="Resumen de compra móvil">
        <div><p class="font-mono text-body-s tabular-nums">{{ pricing.priceLabel }}</p><p class="text-body-s text-ink-2">{{ variant.presentationLabel }} · {{ variant.flavor }} · Cantidad {{ quantity }}</p></div><UiButton :disabled="cart.busy.value || !variant.availableQty || !!quantityError" @click="cart.add(variantId, quantity)">Agregar al carrito</UiButton>
      </div>
    </template>
  </section>
</template>
