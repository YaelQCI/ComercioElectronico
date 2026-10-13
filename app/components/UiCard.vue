<script setup>
defineProps({ title: { type: String, required: true }, to: [String, Object], image: String, imageAlt: { type: String, default: '' } })
</script>
<template>
  <article class="flex h-full min-w-0 flex-col overflow-hidden rounded-sm border border-line bg-surface">
    <div v-if="image" class="aspect-[4/3] bg-packshot p-4"><img :src="image" :alt="imageAlt" width="600" height="450" loading="lazy" class="h-full w-full object-contain"></div>
    <div class="flex flex-1 flex-col gap-3 p-4">
      <h3 class="font-display text-display-m font-bold"><NuxtLink v-if="to" :to="to" class="inline-block py-2 hover:text-accent-text hover:underline">{{ title }}</NuxtLink><template v-else>{{ title }}</template></h3>
      <div class="flex-1"><slot /></div>
      <div v-if="$slots.actions" class="mt-2"><slot name="actions" /></div>
    </div>
  </article>
</template>
