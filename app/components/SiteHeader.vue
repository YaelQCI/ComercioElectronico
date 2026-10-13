<script setup>
import { storeCategories } from '~/utils/navigation'
import { useCart } from '~/features/cart/useCart.js'
import ThemeControl from '~/features/appearance/ThemeControl.vue'
const cart = await useCart()
const route = useRoute()
const menuOpen = ref(false)
const menuButton = ref(null)
const query = ref('')
watch(() => route.query.q, value => { query.value = typeof value === 'string' ? value : '' }, { immediate: true })
watch(() => route.fullPath, () => { menuOpen.value = false })
function closeMenu() {
  if (!menuOpen.value) return
  menuOpen.value = false
  menuButton.value?.focus()
}
function search() {
  const q = query.value.trim()
  const next = route.path === '/catalogo' ? { ...route.query } : {}
  delete next.pagina
  if (q) next.q = q
  else delete next.q
  navigateTo({ path: '/catalogo', query: next })
}
</script>
<template>
  <header class="sticky top-0 z-30 border-b border-line bg-surface text-ink" @keydown.esc="closeMenu">
    <div class="mx-auto max-w-nav px-4 md:px-8">
      <div class="flex min-h-16 flex-wrap items-center justify-between gap-4 py-2">
        <NuxtLink to="/" aria-label="The Fitness Stuff, ir al inicio" class="shrink-0 leading-none">
          <span class="block font-mono text-label uppercase">The</span>
          <span class="block font-display text-display-m font-bold uppercase">Fitness Stuff</span>
          <span class="mt-1 block h-1 w-12 bg-accent" aria-hidden="true" />
        </NuxtLink>
        <nav aria-label="Secciones principales" class="flex flex-wrap items-center justify-end gap-4 text-body-s">
          <ThemeControl />
          <NuxtLink to="/catalogo" class="inline-flex min-h-11 items-center hover:underline">Catálogo</NuxtLink>
          <NuxtLink to="/carrito" class="inline-flex min-h-11 items-center gap-2 hover:underline"><UiIcon name="cart" /><span>Carrito<span v-if="cart.data.value"> · {{ cart.data.value.pieces }} piezas</span></span></NuxtLink>
          <button ref="menuButton" type="button" :aria-expanded="menuOpen" aria-controls="mobile-categories" class="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 lg:hidden" @click="menuOpen = !menuOpen">
            <UiIcon :name="menuOpen ? 'close' : 'menu'" /><span>Menú</span>
          </button>
        </nav>
      </div>
      <div class="flex flex-wrap items-center gap-4 pb-3">
        <nav class="hidden flex-1 lg:block" aria-label="Categorías de producto">
          <ul class="flex flex-wrap gap-x-4 gap-y-2 text-body-s">
            <li v-for="category in storeCategories" :key="category.slug"><NuxtLink :to="{ path: '/catalogo', query: { categoria: category.slug } }" class="inline-flex min-h-11 items-center hover:text-accent-text hover:underline">{{ category.name }}</NuxtLink></li>
          </ul>
        </nav>
        <form role="search" class="flex w-full items-center gap-2 lg:w-72" @submit.prevent="search">
          <label for="header-search" class="sr-only">Buscar productos</label>
          <input id="header-search" v-model="query" name="q" type="search" maxlength="120" placeholder="Creatina, whey…" class="min-h-11 min-w-0 flex-1 rounded-sm border border-border bg-surface px-3 text-ink placeholder:text-ink-2">
          <button type="submit" aria-label="Buscar" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border bg-surface hover:bg-surface-2"><UiIcon name="search" /></button>
        </form>
      </div>
      <nav id="mobile-categories" v-show="menuOpen" aria-label="Categorías de producto, menú móvil" class="border-t border-line py-3 lg:hidden">
        <ul class="grid gap-2 sm:grid-cols-2">
          <li v-for="category in storeCategories" :key="category.slug"><NuxtLink :to="{ path: '/catalogo', query: { categoria: category.slug } }" class="flex min-h-11 items-center rounded-sm px-3 hover:bg-surface-2">{{ category.name }}</NuxtLink></li>
        </ul>
      </nav>
    </div>
    <p v-if="cart.message.value" role="status" class="mx-auto max-w-store px-4 py-2 text-body-s text-ok">{{ cart.message.value }}</p>
    <p v-if="cart.failure.value" role="alert" class="mx-auto max-w-store px-4 py-2 text-body-s text-crit">{{ cart.failure.value }}</p>
  </header>
</template>
