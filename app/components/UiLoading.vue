<script setup>
defineProps({ label: { type: String, default: 'Cargando…' }, cards: { type: Number, default: 3 }, variant: { type: String, default: 'cards', validator: value => ['cards', 'list', 'form', 'product'].includes(value) } })
</script>
<template>
  <div role="status" aria-live="polite" aria-busy="true" data-loading-skeleton>
    <p class="mb-4 text-ink-2">{{ label }}</p>
    <div v-if="variant === 'cards'" aria-hidden="true" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 motion-safe:animate-pulse">
      <div v-for="index in cards" :key="index" class="rounded-sm border border-line bg-surface p-4"><div class="aspect-[4/3] bg-surface-2" /><div class="mt-4 h-6 w-3/4 bg-surface-2" /><div class="mt-3 h-4 w-1/2 bg-surface-2" /></div>
    </div>
    <div v-else-if="variant === 'list'" aria-hidden="true" class="grid gap-4 motion-safe:animate-pulse">
      <div v-for="index in cards" :key="index" class="flex gap-4 rounded-sm border border-line bg-surface p-4"><div class="h-20 w-20 shrink-0 rounded-sm bg-surface-2" /><div class="flex-1 space-y-3 py-1"><div class="h-5 w-3/4 bg-surface-2" /><div class="h-4 w-1/2 bg-surface-2" /><div class="h-4 w-1/3 bg-surface-2" /></div></div>
    </div>
    <div v-else-if="variant === 'form'" aria-hidden="true" class="grid max-w-3xl gap-5 rounded-sm border border-line bg-surface p-5 motion-safe:animate-pulse sm:grid-cols-2">
      <div v-for="index in 6" :key="index"><div class="mb-2 h-4 w-1/3 bg-surface-2" /><div class="h-11 rounded-sm bg-surface-2" /></div><div class="h-11 w-36 rounded-sm bg-surface-2 sm:col-span-2" />
    </div>
    <div v-else aria-hidden="true" class="grid gap-6 motion-safe:animate-pulse md:grid-cols-2">
      <div class="aspect-square rounded-sm border border-line bg-surface-2" /><div class="space-y-5"><div class="h-8 w-3/4 bg-surface-2" /><div class="h-5 w-1/3 bg-surface-2" /><div v-for="index in 3" :key="index" class="h-12 rounded-sm bg-surface-2" /><div class="h-11 w-1/2 bg-surface-2" /></div>
    </div>
  </div>
</template>
