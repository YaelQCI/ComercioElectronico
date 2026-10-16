<script setup>
const route = useRoute()
const { isLoading, progress } = useLoadingIndicator({ throttle: 200, hideDelay: 100 })
</script>
<template>
  <div class="flex min-h-screen flex-col" :class="route.path.startsWith('/producto/') || route.path === '/carrito' ? 'pb-32 lg:pb-0' : ''">
    <a href="#contenido" class="sr-only z-50 rounded-sm bg-accent px-4 py-3 text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Saltar al contenido</a>
    <SiteHeader />
    <div v-if="isLoading" class="fixed inset-x-0 top-0 z-50 h-1 bg-surface-2" aria-hidden="true"><div class="h-full bg-accent motion-safe:transition-[width]" :style="{ width: `${progress}%` }" /></div>
    <main id="contenido" tabindex="-1" class="min-w-0 flex-1 scroll-mt-44" :aria-busy="isLoading">
      <UiPageLoading v-if="isLoading" />
      <div v-show="!isLoading" :inert="isLoading"><slot /></div>
    </main>
    <SiteFooter />
  </div>
</template>
