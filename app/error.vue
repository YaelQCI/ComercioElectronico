<script setup>
const props = defineProps({ error: Object })
const missing = computed(() => props.error?.statusCode === 404)
useHead(() => ({ title: `${missing.value ? 'Página no disponible' : 'No pudimos cargar la página'} — The Fitness Stuff` }))
</script>
<template>
  <main class="mx-auto flex min-h-screen max-w-store flex-col justify-center px-4 py-12 md:px-8">
    <p class="font-mono text-label uppercase text-accent-text">The Fitness Stuff</p>
    <h1 class="mt-4 font-display text-display-l font-bold">{{ missing ? 'Página o producto no disponible' : 'No pudimos cargar la página' }}</h1>
    <p role="alert" class="mt-4 text-ink-2">{{ missing ? 'Revisa la dirección o explora los productos del catálogo.' : 'Intenta de nuevo en unos momentos.' }}</p>
    <div class="mt-6"><UiButton @click="clearError({ redirect: '/catalogo' })">Ir al catálogo</UiButton></div>
    <UiToasts />
    <UiErrorNotifications />
  </main>
</template>
