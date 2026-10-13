<script setup>
useHead({ title: 'Carrito — The Fitness Stuff' })
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-12 md:px-8">
    <UiBreadcrumbs :items="[{ label: 'Carrito' }]" />
    <h1 class="text-display-l font-bold">Tu carrito</h1>
    <p class="mt-6 text-ink-2">Pronto podrás agregar tus productos aquí.</p>
    <div class="mt-6"><UiButton to="/catalogo">Explorar catálogo</UiButton></div>
  </section>
</template>
