<script setup>
import ProductCard from './ProductCard.vue'
import HomePriceGuarantee from './HomePriceGuarantee.vue'
import HomeBenefits from './HomeBenefits.vue'
import { useCart } from '../cart/useCart.js'
const cart=await useCart()
const { data, status, error, refresh } = await useFetch('/api/catalog/home')
const categoryIcon = slug => ({ proteina: 'box', creatina: 'bolt', 'pre-entreno': 'tag', electrolitos: 'bag', vitaminas: 'shield', aminoacidos: 'box', accesorios: 'chart' })[slug] ?? 'box'
useHead({ title: 'The Fitness Stuff — Suplementos y accesorios' })
</script>
<template>
  <div>
    <section class="bg-ink text-on-ink" aria-labelledby="home-heading">
      <div class="home-entrance mx-auto max-w-[820px] px-4 py-16 md:px-8 md:py-24">
        <h1 id="home-heading" class="max-w-3xl font-display text-display-xl font-bold uppercase leading-[0.95]"><span class="block">Suplementos originales de</span><span class="block">EE. UU., al precio que ves</span></h1>
        <p class="mt-6 max-w-xl text-body-l text-on-ink-2">Cada producto llega con su número de lote, caducidad y certificado de análisis. El precio del catálogo ya incluye impuestos y aduana: no pagas nada extra cuando el paquete toca tu puerta.</p>
        <UiButton to="/catalogo" class="mt-8 focus-visible:outline-on-ink-accent">Ver catálogo</UiButton>
      </div>
    </section>
    <div class="mx-auto max-w-store px-4 py-16 md:px-8 md:py-24" :aria-busy="status === 'pending'">
      <HomePriceGuarantee />
      <div class="mt-20 md:mt-40">
      <p v-if="cart.failure.value" role="alert" class="mb-4 rounded-sm border border-border bg-crit-soft p-4 text-crit">{{ cart.failure.value }}</p>
      <UiLoading v-if="status === 'pending'" label="Cargando selección y categorías…" :cards="4" />
      <div v-else-if="error" role="alert" class="rounded-sm border border-border bg-crit-soft p-6 text-crit"><p>No pudimos cargar la selección de la tienda.</p><UiButton class="mt-4" variant="secondary" @click="refresh()">Reintentar</UiButton></div>
      <template v-else>
        <section aria-labelledby="featured-heading">
          <p class="font-mono text-label font-semibold uppercase tracking-widest text-accent-text">Catálogo</p>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-4"><h2 id="featured-heading" class="font-display text-display-l font-bold uppercase">Nuestra selección</h2><NuxtLink to="/catalogo" class="inline-flex min-h-11 items-center text-body-s text-accent-text underline">Ver catálogo completo</NuxtLink></div>
          <div v-if="data?.featured?.length" class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><ProductCard v-for="product in data.featured" :key="product.id" :product="product" /></div>
          <p v-else class="mt-6 rounded-sm border border-line bg-surface p-6 text-ink-2">Estamos preparando nuestra selección de productos.</p>
        </section>
      </template>
      </div>
      <HomeBenefits class="mt-24 md:mt-48" />
        <section class="mt-24 md:mt-40" aria-labelledby="categories-heading">
          <p class="font-mono text-label font-semibold uppercase tracking-widest text-accent-text">Explora</p>
          <h2 id="categories-heading" class="mt-2 font-display text-display-l font-bold uppercase">Compra por categoría</h2>
          <UiLoading v-if="status === 'pending'" class="mt-8" label="Cargando categorías" variant="list" />
          <ul v-else-if="data?.categories?.length" class="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
            <li v-for="category in data.categories" :key="category.slug"><NuxtLink :to="{ path: '/catalogo', query: { categoria: category.slug } }" class="flex h-full min-h-36 flex-col items-start justify-center rounded-sm border border-line bg-surface p-4 hover:border-border hover:bg-surface-2"><UiIcon :name="categoryIcon(category.slug)" class="mb-4 text-accent-text" /><span class="font-display text-body-l font-bold uppercase">{{ category.name }}</span><span class="mt-2 font-mono text-label text-ink-2">{{ category.productCount }} {{ category.productCount === 1 ? 'producto' : 'productos' }}</span></NuxtLink></li>
          </ul>
          <p v-else class="mt-4 text-ink-2">Las categorías aparecerán cuando publiquemos el catálogo.</p>
        </section>
    </div>
  </div>
</template>
<style scoped>
@keyframes arrival { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@media (prefers-reduced-motion:no-preference) {
  .home-entrance > * { animation:arrival 240ms ease-out both; }
  .home-entrance > :nth-child(2) { animation-delay:50ms; }
  .home-entrance > :nth-child(3) { animation-delay:100ms; }
  .home-entrance > :nth-child(4) { animation-delay:150ms; }
  .feedback-enter-active { transition:opacity 160ms ease-out,transform 160ms ease-out; }
  .feedback-enter-from { opacity:0; transform:translateY(4px); }
}
</style>
