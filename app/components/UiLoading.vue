<script setup>
defineProps({ label: { type: String, default: 'Cargando…' }, cards: { type: Number, default: 3 } })
</script>
<template>
  <div role="status" aria-live="polite">
    <p class="mb-4 text-ink-2">{{ label }}</p>
    <div aria-hidden="true" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 motion-safe:animate-pulse">
      <div v-for="index in cards" :key="index" class="rounded-sm border border-line bg-surface p-4"><div class="aspect-[4/3] bg-surface-2" /><div class="mt-4 h-6 w-3/4 bg-surface-2" /><div class="mt-3 h-4 w-1/2 bg-surface-2" /></div>
    </div>
  </div>
</template>
