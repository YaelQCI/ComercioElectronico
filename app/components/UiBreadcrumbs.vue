<script setup>
defineProps({ items: { type: Array, required: true } })
</script>
<template>
  <nav v-if="items.length" aria-label="Ruta de navegación" class="mb-6 text-body-s text-ink-2">
    <ol class="flex flex-wrap items-center gap-2">
      <li><NuxtLink to="/" class="underline hover:text-accent-text">Inicio</NuxtLink></li>
      <li v-for="(item, index) in items" :key="index" class="flex items-center gap-2">
        <span aria-hidden="true">/</span>
        <NuxtLink v-if="item.to && index !== items.length - 1" :to="item.to" class="underline hover:text-accent-text">{{ item.label }}</NuxtLink>
        <span v-else :aria-current="index === items.length - 1 ? 'page' : undefined">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>
