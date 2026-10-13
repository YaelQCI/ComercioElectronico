<script setup>
const route = useRoute()
const names = { privacidad: 'Aviso de privacidad', terminos: 'Términos y condiciones', devoluciones: 'Devoluciones' }
const title = computed(() => names[route.params.slug])
if (!title.value) throw createError({ statusCode: 404, statusMessage: 'Página no encontrada' })
useHead(() => ({ title: `${title.value} — The Fitness Stuff` }))
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-12 md:px-8">
    <UiBreadcrumbs :items="[{ label: title }]" />
    <h1 class="text-display-l font-bold">{{ title }}</h1>
    <p class="mt-6 text-ink-2">El contenido de esta política está pendiente de publicación.</p>
  </section>
</template>
